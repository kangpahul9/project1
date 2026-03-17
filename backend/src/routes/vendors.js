import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { addBankTransaction } from "../utils/bankLedger.js";

const router = express.Router();

/* ===============================
   GET ALL VENDORS
================================ */



router.get("/", authenticate,async (req, res) => {
  console.log(req.settings);
  console.log("RestaurantID:", req.restaurantId);
  
  try {
    const result = await pool.query(
      "SELECT id, name, phone FROM vendors WHERE restaurant_id=$1 ORDER BY name ASC",[req.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   ADD VENDOR (ADMIN ONLY)
================================ */
router.post("/", authenticate, requireAdmin, async (req, res) => {
  const { name, phone } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Vendor name required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO vendors (restaurant_id,name, phone, created_by) VALUES ($1, $2, $3,$4) RETURNING *",
      [req.restaurantId,name.trim(), phone || null, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Vendor already exists" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/summary", authenticate,requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
  v.id,
  v.name,
  COALESCE(SUM(CASE WHEN e.is_paid = FALSE THEN e.amount END), 0) AS total_unpaid,
  COALESCE(
    SUM(CASE WHEN e.is_paid = TRUE THEN COALESCE(e.amount_paid,0) END),
    0
  ) AS total_paid,
  COALESCE(SUM(e.amount), 0) AS lifetime_total
FROM vendors v
LEFT JOIN expenses e 
  ON e.vendor_id = v.id 
  AND e.restaurant_id = $1
WHERE v.restaurant_id = $1
GROUP BY v.id
ORDER BY v.name ASC
    `,[req.restaurantId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   GET UNPAID EXPENSES FOR VENDOR
================================ */
router.get("/:id/unpaid", authenticate,requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e.amount,
        e.description,
        e.created_at,
        u.name AS uploaded_by
      FROM expenses e
      LEFT JOIN users u ON u.id = e.user_id
WHERE e.restaurant_id=$1 AND e.vendor_id = $2
      AND e.is_paid = FALSE
      ORDER BY e.created_at DESC
    `, [req.restaurantId,id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   BULK SETTLE VENDOR
================================ */
router.put("/:id/settle", authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  const vendorId = parseInt(req.params.id);

const { expenseIds, payment_method, final_amount, deduct_from_galla, denominations, partnerId } = req.body;
  if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
    return res.status(400).json({ message: "No expenses selected" });
  }

  if (!["card", "online", "cash"].includes(payment_method)) {
    return res.status(400).json({ message: "Invalid payment method" });
  }

  if (!final_amount || final_amount <= 0) {
    return res.status(400).json({ message: "Final amount required" });
  }

  try {
    await client.query("BEGIN");

    const vendorCheck = await client.query(
`
SELECT id
FROM vendors
WHERE restaurant_id=$1 AND id=$2
`,
[req.restaurantId, vendorId]
);

if (!vendorCheck.rows.length) {
  await client.query("ROLLBACK");
  return res.status(404).json({ message: "Vendor not found" });
}

    /* ===============================
       CHECK OPEN BUSINESS DAY
    =============================== */
  const businessDayId = req.businessDayId;

    /* ===============================
       VALIDATE EXPENSES
    =============================== */
    const expensesRes = await client.query(
      `
      SELECT id, amount
      FROM expenses
      WHERE restaurant_id=$1 AND id = ANY($2)
      AND vendor_id = $3
      AND is_paid = FALSE
      `,
      [req.restaurantId,expenseIds, vendorId]
    );

    if (expensesRes.rows.length !== expenseIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid or already paid expenses" });
    }

    const totalDue = expensesRes.rows.reduce(
      (sum, exp) => sum + parseFloat(exp.amount),
      0
    );

    if (parseFloat(final_amount) > totalDue) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Final amount exceeds total due" });
    }

    let withdrawalId = null;

if (payment_method === "cash" && Boolean(deduct_from_galla)) {

if (
  !denominations ||
  typeof denominations !== "object" ||
  Object.keys(denominations).length === 0
) {    await client.query("ROLLBACK");
    return res.status(400).json({ message: "Denominations required" });
  }

  let calculatedTotal = 0;

  for (const [value, qty] of Object.entries(denominations)) {
    if (Number(qty) <= 0) {
  await client.query("ROLLBACK");
  return res.status(400).json({ message: "Invalid denomination quantity" });
}
    calculatedTotal += Number(value) * Number(qty);
  }

  if (calculatedTotal !== parseFloat(final_amount)) {
    await client.query("ROLLBACK");
    return res.status(400).json({ message: "Denomination total mismatch" });
  }

  // 🔥 CHECK AVAILABLE NOTES
  for (const [value, qty] of Object.entries(denominations)) {
    const denomRes = await client.query(
  `SELECT quantity FROM denominations
   WHERE restaurant_id=$1 AND business_day_id = $2 AND note_value = $3
   FOR UPDATE`,
  [req.restaurantId,businessDayId, value]
);

    if (denomRes.rows.length === 0 ||
        denomRes.rows[0].quantity < qty) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Insufficient ₹${value} notes` });
    }
  }

  // 🔥 DEDUCT NOTES
  for (const [value, qty] of Object.entries(denominations)) {
    await client.query(
      `UPDATE denominations
       SET quantity = quantity - $1
       WHERE restaurant_id=$2 AND business_day_id = $3 AND note_value = $4`,
      [qty,req.restaurantId, businessDayId, value]
    );
  }

  // CREATE WITHDRAWAL RECORD
  const withdrawalRes = await client.query(
    `
    INSERT INTO cash_withdrawals
(
 restaurant_id,
 business_day_id,
 amount,
 user_id,
 partner_id,
 reason
)
VALUES ($1,$2,$3,$4,$5,$6)
RETURNING id
    `,
    [
 req.restaurantId,
 businessDayId,
 final_amount,
 partnerId ? null : req.user.id,
 partnerId || null,
 'Supplier Payment'
]
  );

  withdrawalId = withdrawalRes.rows[0].id;
}
    /* ===============================
       CREATE SETTLEMENT RECORD
    =============================== */
    const settlementRes = await client.query(
      `
      INSERT INTO vendor_settlements (
        restaurant_id,
        vendor_id,
        business_day_id,
        total_due,
        total_paid,
        payment_method,
        withdrawal_id,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
      `,
      [
        req.restaurantId,
        vendorId,
        businessDayId,
        totalDue,
        final_amount,
        payment_method,
        withdrawalId || null,
        req.user.id,
      ]
    );

    const settlementId = settlementRes.rows[0].id;

    // 🔥 BANK LEDGER (ONLY ONLINE/CARD)
if (["online", "card"].includes(payment_method)) {

  const bankRes = await client.query(
    `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
    [req.restaurantId]
  );

  const bankAccountId = bankRes.rows[0]?.id;

  if (!bankAccountId) {
    throw new Error("Bank account not configured");
  }

  await addBankTransaction(client, {
    restaurantId: req.restaurantId,
    bankAccountId,
    amount: final_amount,
    type: "debit",
    source: "vendor_settlement",
    referenceId: settlementId,
    description: "Vendor settlement"
  });
}

    /* ===============================
       PROPORTIONAL DISTRIBUTION
    =============================== */
    const ratio = parseFloat(final_amount) / totalDue;

    for (const expense of expensesRes.rows) {
const proportionalPaid = Math.round(
  (parseFloat(expense.amount) * ratio) * 100
) / 100;
      await client.query(
        `
        UPDATE expenses
        SET 
          is_paid = TRUE,
          amount_paid = $1,
          payment_method = $2,
          paid_at = NOW(),
          paid_by = $3,
          settlement_id = $4
        WHERE restaurant_id=$5 AND id = $6
        `,
        [
          proportionalPaid,
          payment_method,
          req.user.id,
          settlementId,
          req.restaurantId,
          expense.id,
        ]
      );
    }

    await client.query("COMMIT");

    res.json({
      message: "Settlement successful",
      settlement_id: settlementId,
      total_due: totalDue,
      total_paid: parseFloat(final_amount),
      difference: totalDue - parseFloat(final_amount),
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

router.get("/:id/settlements", authenticate, requireAdmin,async (req, res) => {

  if (!req.settings.enable_vendor_ledger) {
  return res.status(403).json({
    message: "Vendor ledger disabled"
  });
}

  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        vs.id,
        vs.total_due,
        vs.total_paid,
        vs.payment_method,
        vs.created_at,
        u.name AS created_by
      FROM vendor_settlements vs
      JOIN users u ON u.id = vs.created_by AND u.restaurant_id=$1
      WHERE vs.vendor_id = $2 AND vs.restaurant_id=$1
      ORDER BY vs.created_at DESC
      `,
      [req.restaurantId,id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch settlements" });
  }
});
export default router;