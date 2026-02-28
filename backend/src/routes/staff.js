import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ===============================
   GET ALL STAFF
================================ */
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM staff
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch staff" });
  }
});

router.get("/with-balance", authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*,
        COALESCE(SUM(
          CASE
             WHEN t.type = 'payment' THEN -t.amount
              WHEN t.type = 'adjustment' THEN t.amount
          END
        ),0) AS balance
      FROM staff s
      LEFT JOIN staff_transactions t 
      ON s.id = t.staff_id
      WHERE s.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch balances" });
  }
});

/* ===============================
   STAFF SUMMARY
================================ */
router.get("/summary", authenticate, async (req, res) => {
  try {
    // 1️⃣ Total Salary (static monthly obligation)
    const totalSalaryRes = await pool.query(`
      SELECT COALESCE(SUM(salary),0) AS total
      FROM staff
      WHERE is_active = TRUE
    `);

    // 2️⃣ Paid This Month
    const paidRes = await pool.query(`
      SELECT COALESCE(SUM(amount),0) AS paid
      FROM staff_transactions
      WHERE type = 'payment'
      AND DATE_TRUNC('month', created_at) =
          DATE_TRUNC('month', CURRENT_DATE)
    `);

    // 3️⃣ Get balances per staff
    const balanceRes = await pool.query(`
      SELECT 
        s.id,
        COALESCE(SUM(
          CASE
            WHEN t.type = 'payment' THEN -t.amount
            WHEN t.type = 'adjustment' THEN t.amount
          END
        ),0) AS balance
      FROM staff s
      LEFT JOIN staff_transactions t 
      ON s.id = t.staff_id
      WHERE s.is_active = TRUE
      GROUP BY s.id
    `);

    let totalUnpaid = 0;
    let totalCredit = 0;

    balanceRes.rows.forEach(row => {
      const balance = Number(row.balance);

      if (balance > 0) {
        totalUnpaid += balance;
      } else if (balance < 0) {
        totalCredit += Math.abs(balance);
      }
    });

    res.json({
      totalSalary: Number(totalSalaryRes.rows[0].total),
      paidThisMonth: Number(paidRes.rows[0].paid),
      unpaidThisMonth: totalUnpaid,
      totalCredit: totalCredit
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch summary" });
  }
});

/* ===============================
   GET ROSTER RANGE
================================ */
router.get("/roster", authenticate, async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ message: "Start and end required" });
  }

  try {
    const result = await pool.query(
      `
      SELECT r.*, s.name
      FROM staff_roster r
      JOIN staff s ON s.id = r.staff_id
      WHERE r.date BETWEEN $1 AND $2
      ORDER BY r.date ASC
      `,
      [start, end]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch roster" });
  }
});

//add shift to roster
router.post("/roster", authenticate, async (req, res) => {
  const { staff_id, date, shift_start, shift_end } = req.body;

  if (!staff_id || !date || !shift_start || !shift_end) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    // Prevent overlap
    const overlap = await pool.query(
      `
      SELECT 1 FROM staff_roster
      WHERE staff_id = $1
      AND date = $2
      AND (
        (shift_start <= $3 AND shift_end > $3) OR
        (shift_start < $4 AND shift_end >= $4)
      )
      `,
      [staff_id, date, shift_start, shift_end]
    );

    if (overlap.rows.length > 0) {
      return res.status(400).json({ message: "Shift overlap detected" });
    }

    const result = await pool.query(
      `
      INSERT INTO staff_roster
      (staff_id, date, shift_start, shift_end)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [staff_id, date, shift_start, shift_end]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create shift" });
  }
});

//update shift
router.put("/roster/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { shift_start, shift_end } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE staff_roster
      SET shift_start = $1,
          shift_end = $2
      WHERE id = $3
      RETURNING *
      `,
      [shift_start, shift_end, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to update shift" });
  }
});

//delete shift
router.delete("/roster/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `DELETE FROM staff_roster WHERE id = $1`,
      [id]
    );

    res.json({ message: "Shift deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete shift" });
  }
});
/* ===============================
   STAFF HISTORY
================================ */
router.get("/:id/history", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        t.*,
        t.payment_method,
        t.created_at
      FROM staff_transactions t
      WHERE t.staff_id = $1
      ORDER BY t.created_at ASC
      `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

router.post("/:id/transaction", authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;

  const {
    amount,
    type,
    reason,
    payment_method,
    deduct_from_galla,
    denominations,
    businessDayId,
  } = req.body;

  if (!amount || !type) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    await client.query("BEGIN");

    let withdrawalId = null;

    if (
      type === "payment" &&
      payment_method === "cash" &&
      deduct_from_galla
    ) {
      if (!denominations || Object.keys(denominations).length === 0) {
        throw new Error("Denominations required");
      }

      let calculatedTotal = 0;

      for (const [value, qty] of Object.entries(denominations)) {
        calculatedTotal += Number(value) * Number(qty);
      }

      if (calculatedTotal !== Number(amount)) {
        throw new Error("Denomination total mismatch");
      }

      // Deduct notes
      for (const [value, qty] of Object.entries(denominations)) {
        await client.query(
          `
          UPDATE denominations
          SET quantity = quantity - $1
          WHERE business_day_id = $2 AND note_value = $3
          `,
          [qty, businessDayId, value]
        );
      }

      // Create withdrawal record
      const withdrawalRes = await client.query(
        `
        INSERT INTO cash_withdrawals
        (business_day_id, amount, reason)
        VALUES ($1,$2,$3)
        RETURNING id
        `,
        [businessDayId, amount, `Staff Salary`]
      );

      withdrawalId = withdrawalRes.rows[0].id;
    }

    const result = await client.query(
      `
      INSERT INTO staff_transactions
(staff_id, amount, type, reason, business_day_id, withdrawal_id)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [id, amount, type, reason || null, businessDayId || null, withdrawalId]
    );

    await client.query("COMMIT");

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: err.message || "Transaction failed" });
  } finally {
    client.release();
  }
});

/* ===============================
   ADD STAFF (ADMIN)
================================ */
router.post("/", authenticate, requireAdmin, async (req, res) => {
const { name, role, phone, salary, opening_balance } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name required" });
  }

  try {
    const result = await pool.query(
  `
  INSERT INTO staff (name, role, phone, salary)
  VALUES ($1,$2,$3,$4)
  RETURNING *
  `,
  [name.trim(), role || null, phone || null, salary || 0]
);

const staff = result.rows[0];

// 🔥 ADD OPENING BALANCE IF PROVIDED
if (opening_balance && Number(opening_balance) !== 0) {
  await pool.query(
    `
    INSERT INTO staff_transactions
    (staff_id, amount, type, reason)
    VALUES ($1,$2,'adjustment','Opening Balance')
    `,
    [staff.id, opening_balance]
  );
}

res.status(201).json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create staff" });
  }
});

/* ===============================
   UPDATE STAFF
================================ */
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, role, phone, salary, is_active } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE staff
      SET name=$1,
          role=$2,
          phone=$3,
          salary=$4,
          is_active=$5
      WHERE id=$6
      RETURNING *
      `,
      [name, role, phone, salary, is_active, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update staff" });
  }
});

/* ===============================
   SOFT DELETE STAFF
================================ */
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `UPDATE staff SET is_active = FALSE WHERE id = $1`,
      [id]
    );

    res.json({ message: "Staff deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to deactivate staff" });
  }
});

export default router;