import express from "express";
import pool from "../config/db.js";
import { authenticate,requireAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";
import { addBankTransaction } from "../utils/bankLedger.js";

const router = express.Router();

/* =========================================
   CREATE EXPENSE
========================================= */
router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();
 
  try {
    const {
  amount,
  category,
  description,
  paymentMode,
  vendorId,
  staff_id,
  document_url,
  is_paid,
  deduct_from_galla,
  denominations,
  source,
  partnerId,
  date
} = req.body;

if (!amount || !category || !paymentMode) {
    return res.status(400).json({ message: "Missing required fields" });
}

if (category === "supplies" && !vendorId) {
  return res.status(400).json({ message: "Vendor required for supplies" });
}

if (category === "salary" && !staff_id) {
  return res.status(400).json({ message: "Staff member required for salary expense" });
}

const expenseDate = date
  ? new Date(date)
  : new Date();

    // 🔥 ENFORCE CASH RULE
   
    await client.query("BEGIN");

     const finalBusinessDayId = req.businessDayId

    // Validate vendor
    if (vendorId) {
  const vendorCheck = await client.query(
    "SELECT id FROM vendors WHERE restaurant_id = $1 AND id = $2",
    [req.restaurantId,vendorId]
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

  for (const [value, qty] of Object.entries(denominations)) {

  const check = await client.query(
  `
  SELECT quantity
  FROM denominations
  WHERE restaurant_id = $1 AND business_day_id = $2 AND note_value = $3
  `,
  [req.restaurantId, finalBusinessDayId, value]
  );

  if (!check.rows.length || check.rows[0].quantity < qty) {
    throw new Error(`Not enough ₹${value} notes`);
  }

  await client.query(
  `
  UPDATE denominations
  SET quantity = quantity - $1
  WHERE restaurant_id = $2 AND business_day_id = $3 AND note_value = $4
  `,
  [qty, req.restaurantId, finalBusinessDayId, value]
  );
}


  // Record withdrawal
 let reason = 'Other';

if (category === 'utility') reason = 'Utilities';
else if (category === 'supplies') reason = 'Supplier Payment';
else if (category === 'salary') reason = 'Staff Salary';

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
 finalBusinessDayId,
 amount,
 partnerId ? null : req.user.id,
 partnerId || null,
 reason
]
);

withdrawalId = withdrawalRes.rows[0].id;
}

    /* ===============================
       INSERT EXPENSE
    =============================== */
    const result = await client.query(
`INSERT INTO expenses
(
  restaurant_id,
  business_day_id,
  vendor_id,
  amount,
  category,
  description,
  payment_method,
  user_id,
  partner_id,
  staff_id,
  document_url,
  is_paid,
  source,
  expense_date
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
RETURNING *
`,
[
  req.restaurantId,
  finalBusinessDayId,
  vendorId,
  amount,
  category,
  description || null,
  paymentMode,
  partnerId ? null : req.user.id,
  partnerId || null,
  staff_id || null,
  document_url || null,
  is_paid || false,
  source || "manual",
  expenseDate
]
);

// 🔥 BANK LEDGER (ONLY ONLINE/CARD + PAID)
if (
  ["online", "card"].includes(paymentMode) &&
  is_paid
) {
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
    amount,
    type: "debit",
    source: "expense",
    referenceId: result.rows[0].id,
    description: description || category
  });
}

// 🔥 ADD THIS
if (
  category === "salary" &&
  staff_id &&
  is_paid &&
  source !== "staff_payment"
){
  await client.query(
    `
    INSERT INTO staff_transactions
(restaurant_id, staff_id, amount, type, reason, business_day_id, expense_id)
VALUES ($1,$2,$3,'payment','Salary Payment',$4,$5)
    `,
    [
  req.restaurantId,
  staff_id,
  amount,
  finalBusinessDayId,
  result.rows[0].id
]
  );
}

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
router.get("/", authenticate, requireAdmin,async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
  e.*,
  u.name AS created_by,
  s.name AS staff_name,
  v.name AS vendor_name,
  p.name AS partner_name
FROM expenses e
LEFT JOIN users u 
  ON e.user_id = u.id AND u.restaurant_id = $1

LEFT JOIN staff s 
  ON e.staff_id = s.id AND s.restaurant_id = $1

LEFT JOIN vendors v 
  ON e.vendor_id = v.id AND v.restaurant_id = $1

LEFT JOIN partners p
  ON e.partner_id = p.id AND p.restaurant_id = $1
WHERE e.restaurant_id = $1
ORDER BY COALESCE(e.expense_date, e.created_at) DESC
    `
    , [req.restaurantId]);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});


/* =========================================
   UPDATE EXPENSE
========================================= */
router.put("/:id", authenticate, requireAdmin,async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
const { amount, category, description, paymentMode, vendorId, is_paid, partnerId, date, staff_id } = req.body;
    await client.query("BEGIN");

    const expenseRes = await client.query(
      "SELECT * FROM expenses WHERE id = $1 AND restaurant_id = $2",
      [id, req.restaurantId]
    );

    if (expenseRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Expense not found" });
    }
    if (category === "supplies" && is_paid) {
      await client.query("ROLLBACK");
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

    const expenseDate = date
  ? new Date(date)
  : expense.expense_date || new Date();


    let amountPaid = expense.amount_paid;
    let paidAt = expense.paid_at;

    // If marking as paid now
    if (!expense.is_paid && is_paid) {
  amountPaid = amount;
  paidAt = new Date();

  /* ===============================
     CASH + GALLA LOGIC (FIX)
  =============================== */
  if (paymentMode === "cash" && req.body.deduct_from_galla) {

    const denominations = req.body.denominations;

    if (!denominations || Object.keys(denominations).length === 0) {
      throw new Error("Denominations required when deducting from galla");
    }

    let calculatedTotal = 0;

    for (const [value, qty] of Object.entries(denominations)) {
      calculatedTotal += Number(value) * Number(qty);
    }

    if (calculatedTotal !== Number(amount)) {
      throw new Error("Denomination total mismatch");
    }

    for (const [value, qty] of Object.entries(denominations)) {

      const check = await client.query(
        `
        SELECT quantity
        FROM denominations
        WHERE restaurant_id=$1 AND business_day_id=$2 AND note_value=$3
        FOR UPDATE
        `,
        [req.restaurantId, expense.business_day_id, value]
      );

      if (!check.rows.length || check.rows[0].quantity < qty) {
        throw new Error(`Not enough ₹${value} notes`);
      }

      await client.query(
        `
        UPDATE denominations
        SET quantity = quantity - $1
        WHERE restaurant_id=$2 AND business_day_id=$3 AND note_value=$4
        `,
        [qty, req.restaurantId, expense.business_day_id, value]
      );
    }

    // 🔥 create withdrawal entry
    let reason = "Other";
    if (expense.category === "utility") reason = "Utilities";
    else if (expense.category === "supplies") reason = "Supplier Payment";
    else if (expense.category === "salary") reason = "Staff Salary";

    await client.query(
      `
      INSERT INTO cash_withdrawals
      (restaurant_id, business_day_id, amount, user_id, reason)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        req.restaurantId,
        expense.business_day_id,
        amount,
        req.user.id,
        reason
      ]
    );
  }

  /* ===============================
     STAFF LOGIC (existing)
  =============================== */
  if (expense.category === "salary" && expense.staff_id) {
    await client.query(
      `
      INSERT INTO staff_transactions
      (restaurant_id, staff_id, amount, type, reason, business_day_id, expense_id)
      VALUES ($1,$2,$3,'payment','Salary Payment',$4,$5)
      `,
      [
        req.restaurantId,
        expense.staff_id,
        amount,
        expense.business_day_id,
        expense.id
      ]
    );
  }
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
    partner_id = $7,
    amount_paid = $8,
    paid_at = $9,
    expense_date = $10,
    staff_id = $11
WHERE id = $12 AND restaurant_id = $13
RETURNING *
      `,
      [
  amount,
  category,
  description || null,
  paymentMode,
  vendorId || null,
  is_paid,
  partnerId || null,
  amountPaid,
  paidAt,
  expenseDate,
  staff_id || null,   // ✅ ADD THIS
  id,
  req.restaurantId
]
    );

    const wasUnpaid = !expense.is_paid && is_paid;

    if (
  wasUnpaid &&
  ["online", "card"].includes(paymentMode)
) {
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
    amount,
    type: "debit",
    source: "expense",
    referenceId: expense.id,
    description: description || category
  });
}

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
router.delete("/:id", authenticate,requireAdmin, async (req, res) => {
  
  try {
    const { id } = req.params;

    const result = await pool.query(
`DELETE FROM expenses
WHERE restaurant_id = $1
AND id = $2
AND is_paid = FALSE
RETURNING id`,
[req.restaurantId, id]
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