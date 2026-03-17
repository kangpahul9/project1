import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";
import { addBankTransaction } from "../utils/bankLedger.js";


const router = express.Router();

/* ===============================
   GET ALL STAFF
================================ */
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM staff
       WHERE restaurant_id=$1 AND is_active = TRUE
       ORDER BY name ASC`, [req.restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch staff" });
  }
});

router.get("/with-balance", authenticate, requireAdmin, async (req, res) => {
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
      ON s.id = t.staff_id AND s.restaurant_id=$1
      WHERE s.restaurant_id=$1 AND s.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.name ASC
    `,[req.restaurantId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch balances" });
  }
});

/* ===============================
   STAFF SUMMARY
================================ */
router.get("/summary", authenticate,requireAdmin,async (req, res) => {
  try {
    // 1️⃣ Total Salary (static monthly obligation)
    const totalSalaryRes = await pool.query(`
      SELECT COALESCE(SUM(salary),0) AS total
      FROM staff
      WHERE is_active = TRUE AND restaurant_id=$1
    `,[req.restaurantId]);

    // 2️⃣ Paid This Month
    const paidRes = await pool.query(`
      SELECT COALESCE(SUM(amount),0) AS paid
      FROM staff_transactions
      WHERE restaurant_id=$1 AND type = 'payment'
      AND DATE_TRUNC('month', created_at) =
          DATE_TRUNC('month', CURRENT_DATE)
    `,[req.restaurantId]);

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
      ON s.id = t.staff_id AND s.restaurant_id=$1
      WHERE s.restaurant_id=$1 AND s.is_active = TRUE
      GROUP BY s.id
    `,[req.restaurantId]);

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

  try {
    const result = await pool.query(
      `
      SELECT 
        s.id AS shift_id,
        s.date,
        s.shift_start,
        s.shift_end,
        json_agg(
          json_build_object(
            'id', st.id,
            'name', st.name
          )
        ) AS staff
      FROM shifts s
      JOIN shift_assignments sa ON sa.shift_id = s.id
      JOIN staff st ON st.id = sa.staff_id
      WHERE s.restaurant_id=$1
      AND s.date BETWEEN $2 AND $3
      GROUP BY s.id
      ORDER BY s.date ASC
      `,
      [req.restaurantId, start, end]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch roster" });
  }
});

//add shift to roster
router.post("/roster", authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  const { date, shift_start, shift_end, staff_ids } = req.body;

  if (!date || !shift_start || !shift_end || !staff_ids?.length) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    await client.query("BEGIN");

    const uniqueStaffIds = [...new Set(staff_ids)];

    // 🚨 OVERLAP CHECK FIRST (important)
    for (const staffId of uniqueStaffIds) {

      const check = await client.query(
        `SELECT id FROM staff WHERE id=$1 AND restaurant_id=$2`,
        [staffId, req.restaurantId]
      );

      if (!check.rows.length) {
        throw new Error(`Invalid staff id ${staffId}`);
      }

      const overlap = await client.query(
        `
        SELECT 1
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.staff_id = $1
        AND s.restaurant_id = $2
        AND s.date = $3
        AND (
          (s.shift_start <= $4 AND s.shift_end > $4) OR
          (s.shift_start < $5 AND s.shift_end >= $5)
        )
        `,
        [staffId, req.restaurantId, date, shift_start, shift_end]
      );

      if (overlap.rows.length) {
        throw new Error(`Shift overlap for staff ${staffId}`);
      }
    }

    // ✅ CREATE SHIFT AFTER VALIDATION
    const shiftRes = await client.query(
      `
      INSERT INTO shifts (restaurant_id, date, shift_start, shift_end, created_by)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [req.restaurantId, date, shift_start, shift_end, req.user.id]
    );

    const shiftId = shiftRes.rows[0].id;

    // ✅ INSERT ASSIGNMENTS
    for (const staffId of uniqueStaffIds) {
      await client.query(
        `
        INSERT INTO shift_assignments (restaurant_id, shift_id, staff_id)
        VALUES ($1,$2,$3)
        `,
        [req.restaurantId, shiftId, staffId]
      );
    }

    await client.query("COMMIT");

    const staffRes = await client.query(
      `
      SELECT st.id, st.name
      FROM shift_assignments sa
      JOIN staff st ON st.id = sa.staff_id
      WHERE sa.shift_id = $1
      `,
      [shiftId]
    );

    res.status(201).json({
      shift: shiftRes.rows[0],
      staff: staffRes.rows
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to create shift" });
  } finally {
    client.release();
  }
});

router.post("/roster/copy", authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  const { from_date, to_date } = req.body;

  try {
    await client.query("BEGIN");

    const shifts = await client.query(
      `
      SELECT s.*, sa.staff_id
      FROM shifts s
      JOIN shift_assignments sa ON sa.shift_id = s.id
      WHERE s.restaurant_id=$1 AND s.date=$2
      `,
      [req.restaurantId, from_date]
    );

    const shiftMap = {};

    for (const row of shifts.rows) {
      const key = `${row.shift_start}-${row.shift_end}`;

      if (!shiftMap[key]) {
        const newShift = await client.query(
          `
          INSERT INTO shifts (restaurant_id, date, shift_start, shift_end)
          VALUES ($1,$2,$3,$4)
          RETURNING id
          `,
          [req.restaurantId, to_date, row.shift_start, row.shift_end]
        );

        shiftMap[key] = newShift.rows[0].id;
      }

      await client.query(
        `
        INSERT INTO shift_assignments (restaurant_id, shift_id, staff_id)
        VALUES ($1,$2,$3)
        `,
        [req.restaurantId, shiftMap[key], row.staff_id]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Roster copied" });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Failed to copy roster" });
  } finally {
    client.release();
  }
});
//update shift
router.put("/roster/:id", authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  const { id } = req.params;
  const { shift_start, shift_end, staff_ids } = req.body;

  try {
    await client.query("BEGIN");

    // ✅ GET SHIFT DATE FIRST
    const shiftDateRes = await client.query(
      `SELECT date FROM shifts WHERE id=$1 AND restaurant_id=$2`,
      [id, req.restaurantId]
    );

    if (!shiftDateRes.rows.length) {
      throw new Error("Shift not found");
    }

    const shiftDate = shiftDateRes.rows[0].date;
    const uniqueStaffIds = [...new Set(staff_ids || [])];

    // 🚨 OVERLAP CHECK BEFORE ANY DELETE
    for (const staffId of uniqueStaffIds) {

      const check = await client.query(
        `SELECT id FROM staff WHERE id=$1 AND restaurant_id=$2`,
        [staffId, req.restaurantId]
      );

      if (!check.rows.length) {
        throw new Error(`Invalid staff id ${staffId}`);
      }

      const overlap = await client.query(
        `
        SELECT 1
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.staff_id = $1
        AND s.restaurant_id = $2
        AND s.date = $3
        AND s.id != $6
        AND (
          (s.shift_start <= $4 AND s.shift_end > $4) OR
          (s.shift_start < $5 AND s.shift_end >= $5)
        )
        `,
        [staffId, req.restaurantId, shiftDate, shift_start, shift_end, id]
      );

      if (overlap.rows.length) {
        throw new Error(`Shift overlap for staff ${staffId}`);
      }
    }

    // ✅ UPDATE SHIFT TIMING
    const shiftRes = await client.query(
      `
      UPDATE shifts
      SET shift_start = $1,
          shift_end = $2
      WHERE id = $3 AND restaurant_id = $4
      RETURNING *
      `,
      [shift_start, shift_end, id, req.restaurantId]
    );

    // ✅ DELETE OLD ASSIGNMENTS
    await client.query(
      `DELETE FROM shift_assignments WHERE shift_id=$1 AND restaurant_id=$2`,
      [id, req.restaurantId]
    );

    // ✅ INSERT NEW ASSIGNMENTS
    for (const staffId of uniqueStaffIds) {
      await client.query(
        `
        INSERT INTO shift_assignments (restaurant_id, shift_id, staff_id)
        VALUES ($1,$2,$3)
        `,
        [req.restaurantId, id, staffId]
      );
    }

    await client.query("COMMIT");

    const staffRes = await client.query(
      `
      SELECT st.id, st.name
      FROM shift_assignments sa
      JOIN staff st ON st.id = sa.staff_id
      WHERE sa.shift_id = $1
      `,
      [id]
    );

    res.json({
      shift: shiftRes.rows[0],
      staff: staffRes.rows
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to update shift" });
  } finally {
    client.release();
  }
});
//delete shift
router.delete("/roster/:id", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      `
      DELETE FROM shifts
      WHERE id = $1 AND restaurant_id = $2
      `,
      [id, req.restaurantId]
    );

    res.json({ message: "Shift deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete shift" });
  }
});
/* ===============================
   STAFF HISTORY
================================ */
router.get("/:id/history", authenticate,requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
  t.*,
  e.payment_method,
  e.description,
e.id as linked_expense_id
FROM staff_transactions t
LEFT JOIN expenses e
ON t.expense_id = e.id AND e.restaurant_id=$1
WHERE t.restaurant_id=$1 AND t.staff_id = $2
ORDER BY t.created_at ASC
      `,
      [req.restaurantId,id]
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
  partnerId
} = req.body;

  if (!amount || !type) {
    return res.status(400).json({ message: "Missing fields" });
  }
  

  try {
    await client.query("BEGIN");

    const staffCheck = await client.query(
`
SELECT id
FROM staff
WHERE restaurant_id=$1 AND id=$2
`,
[req.restaurantId, id]
);

if (staffCheck.rows.length === 0) {
  return res.status(404).json({ message: "Staff not found" });
}

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
        const check = await client.query(
`
SELECT quantity
FROM denominations
WHERE restaurant_id=$1 AND business_day_id=$2 AND note_value=$3
FOR UPDATE
`,
[req.restaurantId, businessDayId, value]
);

if (!check.rows.length || check.rows[0].quantity < qty) {
  throw new Error(`Not enough ₹${value} notes`);
}
        
        await client.query(
          
          `
          UPDATE denominations
          SET quantity = quantity - $1
          WHERE restaurant_id=$2 AND business_day_id = $3 AND note_value = $4
          `,
          [qty,req.restaurantId, businessDayId, value]
        );
        
      }

      // Create withdrawal record
      const withdrawalRes = await client.query(
        `
        INSERT INTO cash_withdrawals
        (restaurant_id,business_day_id, amount, reason)
        VALUES ($1,$2,$3,$4)
        RETURNING id
        `,
        [req.restaurantId,businessDayId, amount, `Staff Salary`]
      );

      withdrawalId = withdrawalRes.rows[0].id;
    }

    const result = await client.query(
      `
      INSERT INTO staff_transactions
(restaurant_id,staff_id, amount, type, reason, business_day_id, withdrawal_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [req.restaurantId,id, amount, type, reason || null, businessDayId || null, withdrawalId]
    );

    if (type === "payment") {

  const expenseRes = await client.query(
  `
  INSERT INTO expenses
(
 restaurant_id,
 business_day_id,
 amount,
 category,
 description,
 payment_method,
 user_id,
 partner_id,
 staff_id,
 is_paid,
 source
)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  RETURNING id
  `,
  [
 req.restaurantId,
 businessDayId,
 amount,
 "salary",
 `Salary payment`,
 payment_method,
 partnerId ? null : req.user.id,
partnerId || null,
 id,
 true,
 "staff_payment"
]
);

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
    amount,
    type: "debit",
    source: "staff_salary",
    referenceId: expenseRes.rows[0].id,
    description: "Staff salary payment"
  });
}

await client.query(
`
UPDATE staff_transactions
SET expense_id = $1
WHERE id = $2 AND restaurant_id=$3
`,
[
  expenseRes.rows[0].id,
  result.rows[0].id,
  req.restaurantId
]
);

}



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
const { name, role, phone, salary, joining_date, opening_balance } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Name required" });
  }

  try {
    const result = await pool.query(
  `
  INSERT INTO staff (restaurant_id,name, role, phone, salary, joining_date)
  VALUES ($1,$2,$3,$4,$5,$6)
  RETURNING *
  `,
  [req.restaurantId,name.trim(), role || null, phone || null, salary || 0, joining_date || new Date()]
);

const staff = result.rows[0];

// 🔥 ADD OPENING BALANCE IF PROVIDED
if (opening_balance !== undefined && Number(opening_balance) !== 0) {
  await pool.query(
    `
    INSERT INTO staff_transactions
    (restaurant_id,staff_id, amount, type, reason)
    VALUES ($1,$2,$3,'adjustment','Opening Balance')
    `,
    [req.restaurantId,staff.id, opening_balance]
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
const { name, role, phone, salary, joining_date, is_active } = req.body;
  try {
    const result = await pool.query(
      `
      UPDATE staff
SET name=$1,
    role=$2,
    phone=$3,
    salary=$4,
    joining_date=$5,
    is_active=$6
WHERE id=$7 AND restaurant_id=$8
RETURNING *
      `,
[name, role, phone, salary, joining_date, is_active, id, req.restaurantId]
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
      `UPDATE staff SET is_active = FALSE WHERE id = $1 AND restaurant_id=$2`,
      [id,req.restaurantId]
    );

    res.json({ message: "Staff deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to deactivate staff" });
  }
});

export default router;