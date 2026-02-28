import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";


const router = express.Router();

/* =========================================
   CREATE EXPENSE
========================================= */
router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      businessDayId,
      amount,
      category,
      description,
      paymentMode,
      vendorId,
      document_url,
      is_paid,
      deduct_from_galla,
      denominations
    } = req.body;

    if (!businessDayId || !amount || !category || !paymentMode) {
  return res.status(400).json({ message: "Missing required fields" });
}

if (category === "supplies" && !vendorId) {
  return res.status(400).json({ message: "Vendor required for supplies" });
}

    // 🔥 ENFORCE CASH RULE
   
    await client.query("BEGIN");

    // Validate vendor
    if (vendorId) {
  const vendorCheck = await client.query(
    "SELECT id FROM vendors WHERE id = $1",
    [vendorId]
  );

  if (vendorCheck.rows.length === 0) {
    await client.query("ROLLBACK");
    return res.status(400).json({ message: "Invalid vendor" });
  }
}

    let withdrawalId = null;

   /* ===============================
   CASH + GALLA LOGIC
=============================== */
if (paymentMode === "cash" && deduct_from_galla) {

  if (!denominations || Object.keys(denominations).length === 0) {
    await client.query("ROLLBACK");
    return res.status(400).json({
      message: "Denominations required when deducting from galla"
    });
  }

  let calculatedTotal = 0;

  for (const [value, qty] of Object.entries(denominations)) {
    calculatedTotal += Number(value) * Number(qty);
  }

  if (calculatedTotal !== Number(amount)) {
    await client.query("ROLLBACK");
    return res.status(400).json({
      message: "Denomination total mismatch"
    });
  }

  // Deduct from denominations table
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

  // Record withdrawal
 let reason = 'Other';

if (category === 'utility') reason = 'Utilities';
else if (category === 'supplies') reason = 'Supplier Payment';
else if (category === 'salary') reason = 'Staff Salary';

await client.query(
  `
  INSERT INTO cash_withdrawals
  (business_day_id, amount, reason)
  VALUES ($1,$2,$3)
  `,
  [businessDayId, amount, reason]
);
}

    /* ===============================
       INSERT EXPENSE
    =============================== */
    const result = await client.query(
      `
      INSERT INTO expenses
      (business_day_id, vendor_id, amount, category, description, payment_method, user_id, document_url, is_paid)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        businessDayId,
        vendorId,
        amount,
        category,
        description || null,
        paymentMode,
        req.user.id,
        document_url || null,
        is_paid || false
      ]
    );

    await client.query("COMMIT");

    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to create expense" });
  } finally {
    client.release();
  }
});


/* =========================================
   GET ALL EXPENSES
========================================= */
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
  e.*,
  u.name AS user_name,
  v.name AS vendor_name
FROM expenses e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN vendors v ON e.vendor_id = v.id
ORDER BY e.created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});


/* =========================================
   UPDATE EXPENSE
========================================= */
router.put("/:id", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { amount, category, description, paymentMode, vendorId, is_paid } = req.body;

    await client.query("BEGIN");

    const expenseRes = await client.query(
      "SELECT * FROM expenses WHERE id = $1",
      [id]
    );

    if (expenseRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Expense not found" });
    }
    if (category === "supplies" && is_paid) {
  return res.status(400).json({
    message: "Supplies must be settled via Vendor Settlement"
  });
}
    const expense = expenseRes.rows[0];

    // Prevent editing settled expense
    if (expense.is_paid && !is_paid) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cannot unpay settled expense" });
    }

    let amountPaid = expense.amount_paid;
    let paidAt = expense.paid_at;

    // If marking as paid now
    if (!expense.is_paid && is_paid) {
      amountPaid = amount;
      paidAt = new Date();
    }

    const result = await client.query(
      `
      UPDATE expenses
      SET amount = $1,
          category = $2,
          description = $3,
          payment_method = $4,
          vendor_id = $5,
          is_paid = $6,
          amount_paid = $7,
          paid_at = $8
      WHERE id = $9
      RETURNING *
      `,
      [
        amount,
        category,
        description || null,
        paymentMode,
        vendorId || null,
        is_paid,
        amountPaid,
        paidAt,
        id
      ]
    );

    await client.query("COMMIT");

    res.json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to update expense" });
  } finally {
    client.release();
  }
});


/* =========================================
   DELETE EXPENSE
========================================= */
router.delete("/:id", authenticate, async (req, res) => {
  
  try {
    const { id } = req.params;

    const result = await pool.query(
  `DELETE FROM expenses
WHERE id = $1
AND is_paid = FALSE
AND business_day_id IN (
  SELECT id FROM business_days WHERE is_closed = false
)
   RETURNING id`,
  [id]
);

if (result.rowCount === 0) {
  return res.status(404).json({ message: "Expense not found or day closed" });
}

res.json({ message: "Expense deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete expense" });
  }
});

router.post(
  "/upload",
  authenticate,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({ url: fileUrl });
  }
);

export default router;