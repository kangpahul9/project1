import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

const VALID_DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

const VALID_REASONS = [
  "Owner Personal",
  "Supplier Payment",
  "Bank Deposit",
  "Petty Cash",
  "Staff Salary",
  "Utilities",
  "Emergency Expense",
  "Loan Repayment",
  "Investment Transfer",
  "Other"
];

const EXPENSE_REASONS = [
  "Supplier Payment",
  "Staff Salary",
  "Utilities",
  "Emergency Expense",
  "Loan Repayment",
  "Investment Transfer",
  "Other"
];
/* =========================================
   OWNER CASH WITHDRAWAL
========================================= */
router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
const { businessDayId, breakdown, reason, description } = req.body;

    if (!businessDayId || !Array.isArray(breakdown) || breakdown.length === 0) {
      return res.status(400).json({ message: "Invalid request format" });
    }

    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({ message: "Invalid withdrawal reason" });
    }
if (reason === "Other" && (!description || description.trim() === "")) {
  return res.status(400).json({
    message: "Description required when reason is 'Other'"
  });
}
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await client.query("BEGIN");

    /* 🔒 Lock denominations rows to prevent race condition */
    const drawerRes = await client.query(
      `
      SELECT note_value, quantity
      FROM denominations
      WHERE business_day_id = $1
      FOR UPDATE
      `,
      [businessDayId]
    );

    if (drawerRes.rows.length === 0) {
      throw new Error("Drawer not initialized");
    }

    // Calculate real drawer total from DB
    let drawerTotal = 0;
    for (const row of drawerRes.rows) {
      drawerTotal += Number(row.note_value) * Number(row.quantity);
    }

    let withdrawalTotal = 0;

    for (const item of breakdown) {
      const note = Number(item.note);
      const qty = Number(item.qty);

      if (!VALID_DENOMS.includes(note)) {
        throw new Error(`Invalid denomination ₹${note}`);
      }

      if (qty <= 0) continue;

      const denomRow = drawerRes.rows.find(
        (r) => Number(r.note_value) === note
      );

      if (!denomRow) {
        throw new Error(`No ₹${note} notes found`);
      }

      if (qty > Number(denomRow.quantity)) {
        throw new Error(`Not enough ₹${note} notes available`);
      }

      withdrawalTotal += note * qty;
    }

    if (withdrawalTotal <= 0) {
      throw new Error("Withdrawal amount must be greater than 0");
    }

    if (withdrawalTotal > drawerTotal) {
      throw new Error("Insufficient drawer balance");
    }

    // Deduct denominations
    for (const item of breakdown) {
      const note = Number(item.note);
      const qty = Number(item.qty);

      if (qty <= 0) continue;

      await client.query(
        `
        UPDATE denominations
        SET quantity = quantity - $1
        WHERE business_day_id = $2
        AND note_value = $3
        `,
        [qty, businessDayId, note]
      );
    }

    await client.query(
      `
      INSERT INTO cash_withdrawals
      (business_day_id, amount, user_id, reason, description)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [businessDayId, withdrawalTotal, req.user.id, reason, description && description.trim() !== "" ? description.trim() : null]
    );

    /* ===============================
   LEDGER ENTRY (WITHDRAWAL)
=============================== */

await client.query(
  `
  INSERT INTO cash_ledger
  (business_day_id, type, reference_id, amount)
  VALUES ($1, 'withdrawal', currval('cash_withdrawals_id_seq'), $2)
  `,
  [businessDayId, -withdrawalTotal]
);

  if (EXPENSE_REASONS.includes(reason)) {

  await client.query(
    `
    INSERT INTO expenses
    (business_day_id, amount, category, description, payment_method, user_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      businessDayId,
      withdrawalTotal,
      reason,
      description ? description.trim() : null,
      "cash",
      req.user.id
    ]
  );
}
    await client.query("COMMIT");

    res.json({
      message: "Withdrawal successful",
      totalAmount: withdrawalTotal
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});


/* =========================================
   WITHDRAWAL HISTORY (GLOBAL + FILTERABLE)
========================================= */
router.get("/history", authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
  SELECT 
    cw.id,
    cw.amount,
    cw.reason,
    cw.description,
    cw.created_at,
    u.name AS user_name
  FROM cash_withdrawals cw
  LEFT JOIN users u ON cw.user_id = u.id
  WHERE 1=1
`;

    const values = [];
    let index = 1;

    if (from) {
      query += ` AND cw.created_at >= $${index}`;
      values.push(from);
      index++;
    }

    if (to) {
      query += ` AND cw.created_at <= $${index}`;
      values.push(`${to} 23:59:59`);
      index++;
    }

    query += ` ORDER BY cw.created_at DESC`;

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.post("/deposit", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { businessDayId, breakdown, reason } = req.body;

    if (!businessDayId || !Array.isArray(breakdown)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await client.query("BEGIN");

    let totalAmount = 0;

    for (const item of breakdown) {
      const note = Number(item.note);
      const qty = Number(item.qty);

      if (!VALID_DENOMS.includes(note) || qty <= 0) continue;

      await client.query(
        `
        UPDATE denominations
        SET quantity = quantity + $1
        WHERE business_day_id = $2
        AND note_value = $3
        `,
        [qty, businessDayId, note]
      );

      totalAmount += note * qty;
    }

    if (totalAmount <= 0) {
      throw new Error("Deposit amount must be greater than 0");
    }

    await client.query(
      `
      INSERT INTO cash_deposits
      (business_day_id, amount, user_id, reason)
      VALUES ($1, $2, $3, $4)
      `,
      [businessDayId, totalAmount, req.user.id, reason || "Drawer Refill"]
    );

    /* ===============================
   LEDGER ENTRY (DEPOSIT)
=============================== */

await client.query(
  `
  INSERT INTO cash_ledger
  (business_day_id, type, reference_id, amount)
  VALUES ($1, 'sale', currval('cash_deposits_id_seq'), $2)
  `,
  [businessDayId, totalAmount]
);

    await client.query("COMMIT");

    res.json({
      message: "Cash added successfully",
      totalAmount
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.get("/deposits-history", authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT 
        cd.id,
        cd.amount,
        cd.reason,
        cd.created_at,
        u.name AS user_name
      FROM cash_deposits cd
      LEFT JOIN users u ON cd.user_id = u.id
      WHERE 1=1
    `;

    const values = [];
    let index = 1;

    if (from) {
      query += ` AND cd.created_at >= $${index}`;
      values.push(from);
      index++;
    }

    if (to) {
      query += ` AND cd.created_at <= $${index}`;
      values.push(`${to} 23:59:59`);
      index++;
    }

    query += ` ORDER BY cd.created_at DESC`;

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
export default router;