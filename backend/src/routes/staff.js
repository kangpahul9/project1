import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";
import { bankWithEvent } from "../utils/bankLedger.js";
import {logEvent} from "../utils/ledger.js";
import bcrypt from "bcrypt";


const router = express.Router();

/* ===============================
   GET ALL STAFF
================================ */
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT s.*, u.email
      FROM staff s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.restaurant_id=$1 
      AND s.is_active = TRUE
      ORDER BY s.name ASC
      `,
      [req.restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch staff");
    res.status(500).json({ message: "Failed to fetch staff" });
  }
});

router.get("/with-balance", authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        u.email,
        COALESCE(SUM(
          CASE
            WHEN t.type = 'payment' THEN -t.amount
            WHEN t.type = 'adjustment' THEN t.amount
          END
        ),0) AS balance,
        COALESCE(adv.advance_total, 0) AS advance_total
      FROM staff s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN staff_transactions t
        ON s.id = t.staff_id AND s.restaurant_id=$1
      LEFT JOIN (
        SELECT staff_id, SUM(amount) AS advance_total
        FROM staff_advances
        WHERE restaurant_id=$1
        GROUP BY staff_id
      ) adv ON adv.staff_id = s.id
      WHERE s.restaurant_id=$1
      AND s.is_active = TRUE
      GROUP BY s.id, u.email, adv.advance_total
      ORDER BY s.name ASC
    `,[req.restaurantId]);

    res.json(result.rows);

  } catch (err) {
    req.log.error({ err }, "Failed to fetch balances");
    res.status(500).json({ message: "Failed to fetch balances" });
  }
});

/* ===============================
   STAFF SUMMARY
================================ */
router.get("/summary", authenticate, requireAdmin, async (req, res) => {
  try {

    const totalSalaryRes = await pool.query(`
      SELECT COALESCE(SUM(salary),0) AS total
      FROM staff
      WHERE is_active = TRUE AND restaurant_id=$1
    `,[req.restaurantId]);

    const paidRes = await pool.query(`
      SELECT COALESCE(SUM(amount),0) AS paid
      FROM staff_transactions
      WHERE restaurant_id=$1 
      AND type = 'payment'
      AND DATE_TRUNC('month', created_at) =
          DATE_TRUNC('month', CURRENT_DATE)
    `,[req.restaurantId]);

    const balanceRes = await pool.query(`
      SELECT 
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
    `,[req.restaurantId]);

    const totalBalance = Number(balanceRes.rows[0].balance);

    const advanceRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM staff_advances
      WHERE restaurant_id=$1
    `, [req.restaurantId]);

    res.json({
      totalSalary: Number(totalSalaryRes.rows[0].total),
      paidThisMonth: Number(paidRes.rows[0].paid),
      unpaidThisMonth: totalBalance > 0 ? totalBalance : 0,
      totalCredit: totalBalance < 0 ? Math.abs(totalBalance) : 0,
      pendingAdvances: Number(advanceRes.rows[0].total),
    });

  } catch (err) {
    req.log.error({ err }, "Failed to fetch summary");
    res.status(500).json({ message: "Failed to fetch summary" });
  }
});

/* ===============================
   STAFF SELF (/me)
================================ */
router.get("/me", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "STAFF") {
      return res.status(403).json({ message: "Only staff allowed" });
    }

    const result = await pool.query(
      `
      SELECT 
        s.*,
        u.email,
        COALESCE(SUM(
          CASE
            WHEN t.type = 'payment' THEN -t.amount
            WHEN t.type = 'adjustment' THEN t.amount
          END
        ),0) AS balance
      FROM staff s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN staff_transactions t
        ON t.staff_id = s.id AND t.restaurant_id=$1
      WHERE s.user_id=$2 AND s.restaurant_id=$1
      GROUP BY s.id, u.email
      `,
      [req.restaurantId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Staff profile not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    req.log.error({ err }, "Failed to fetch profile");
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

/* ===============================
   STAFF SELF HISTORY
================================ */
router.get("/me/history", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "STAFF") {
      return res.status(403).json({ message: "Only staff allowed" });
    }

    const result = await pool.query(
      `
      SELECT 
        t.*,
        e.payment_method,
        e.description
      FROM staff s
      JOIN staff_transactions t 
        ON t.staff_id = s.id
      LEFT JOIN expenses e 
        ON t.expense_id = e.id AND e.restaurant_id=$1
      WHERE s.user_id=$2 AND t.restaurant_id=$1
      ORDER BY t.created_at DESC
      `,
      [req.restaurantId, req.user.id]
    );

    res.json(result.rows);

  } catch (err) {
    req.log.error({ err }, "Failed to fetch history");
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

router.get("/:id/earnings", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { start, end, mode = "actual" } = req.query;

  try {
    const result = await pool.query(`
      SELECT 
        s.id as shift_id,
        s.date,
        s.shift_start,
        s.shift_end,
        s.base_rate,

        sl.actual_hours

      FROM shifts s
      JOIN shift_assignments sa ON sa.shift_id = s.id
      LEFT JOIN shift_logs sl 
        ON sl.shift_id = s.id AND sl.staff_id = sa.staff_id

      WHERE s.restaurant_id=$1
      AND sa.staff_id=$2
      AND s.date BETWEEN $3 AND $4
      AND s.is_deleted=FALSE
    `, [req.restaurantId, id, start, end]);

    let totalHours = 0;
    let totalEarnings = 0;

    for (const r of result.rows) {
      let hours = 0;

      if (mode === "actual") {
        hours = Number(r.actual_hours || 0);
      } else {
        const start = new Date(`${r.date}T${r.shift_start}`);
        const end = new Date(`${r.date}T${r.shift_end}`);
        hours = (end - start) / (1000 * 60 * 60);
      }

      totalHours += hours;
      totalEarnings += hours * Number(r.base_rate || 0);
    }

    // 🔥 subtract already paid
    const paidRes = await pool.query(`
      SELECT COALESCE(SUM(amount),0) as paid
      FROM staff_transactions
      WHERE staff_id=$1 
      AND restaurant_id=$2
      AND type='payment'
    `, [id, req.restaurantId]);

    const paid = Number(paidRes.rows[0].paid);

    res.json({
      totalHours,
      totalEarnings,
      paid,
      remaining: totalEarnings - paid
    });

  } catch (err) {
    req.log.error({ err }, "Failed to fetch earnings");
    res.status(500).json({ message: "Failed to fetch earnings" });
  }
});

/* ===============================
   UPDATE STAFF LOGIN
================================ */
router.put("/:id/login", authenticate, requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { email, password } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const staff = await client.query(
      `SELECT user_id FROM staff WHERE id=$1 AND restaurant_id=$2`,
      [id, req.restaurantId]
    );

    if (!staff.rows.length) {
      throw new Error("Staff not found");
    }

    const userId = staff.rows[0].user_id;

    if (!userId) {
      throw new Error("No linked user");
    }

    let hashed = null;
    if (password) {
      hashed = await bcrypt.hash(password, 10);
    }

    await client.query(
      `
      UPDATE users
      SET 
        email = COALESCE($1, email),
        password_hash = COALESCE($2, password_hash)
      WHERE id=$3
      `,
      [email || null, hashed, userId]
    );

    await client.query("COMMIT");

    res.json({ message: "Login updated" });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* ===============================
   STAFF ADVANCE HISTORY (AUD)
================================ */
router.get("/:id/advance-history", authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, amount, notes, payroll_batch_id, created_at,
              CASE WHEN amount < 0 THEN 'repayment' ELSE 'advance' END AS entry_type
       FROM staff_advances
       WHERE restaurant_id=$1 AND staff_id=$2
       ORDER BY created_at DESC`,
      [req.restaurantId, id]
    );
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch advance history");
    res.status(500).json({ message: "Failed to fetch advance history" });
  }
});

/* ===============================
   STAFF HISTORY
================================ */
router.get("/:id/history", authenticate, requireAdmin, async (req, res) => {
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
      WHERE t.restaurant_id=$1 
      AND t.staff_id = $2
      ORDER BY t.created_at DESC
      `,
      [req.restaurantId,id]
    );

    res.json(result.rows);

  } catch (err) {
    req.log.error({ err }, "Failed to fetch staff history");
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

  if (!amount || Number(amount) <= 0 || !type) {
    return res.status(400).json({ message: "Invalid amount or type" });
  }

  try {
    await client.query("BEGIN");

    const staffCheck = await client.query(
      `SELECT id FROM staff WHERE restaurant_id=$1 AND id=$2`,
      [req.restaurantId, id]
    );

    if (!staffCheck.rows.length) {
      throw new Error("Staff not found");
    }

    let withdrawalId = null;

    

    /* =========================
       CASH FROM GALLA
    ========================= */
    if (
      type === "payment" &&
      payment_method === "cash" &&
      deduct_from_galla
    ) {
if (req.settings.use_business_day && !req.businessDayId) {
  throw new Error("Business day not active");
}
      if (!denominations || Object.keys(denominations).length === 0) {
        throw new Error("Denominations required");
      }

      let calculatedTotal = 0;

      for (const [value, qty] of Object.entries(denominations)) {
        calculatedTotal += Number(value) * Number(qty);
      }

      if (calculatedTotal !== Number(amount)) {
        throw new Error("Denomination mismatch");
      }

      for (const [value, qty] of Object.entries(denominations)) {
        const check = await client.query(
          `
          SELECT quantity FROM denominations
          WHERE restaurant_id=$1 AND business_day_id=$2 AND note_value=$3
          FOR UPDATE
          `,
          [req.restaurantId, businessDayId, value]
        );

        if (!check.rows.length || check.rows[0].quantity < qty) {
          throw new Error(`Insufficient ₹${value}`);
        }

        await client.query(
          `
          UPDATE denominations
          SET quantity = quantity - $1
          WHERE restaurant_id=$2 AND business_day_id=$3 AND note_value=$4
          `,
          [qty, req.restaurantId, businessDayId, value]
        );
      }

      const withdrawalRes = await client.query(
        `
        INSERT INTO cash_withdrawals
        (restaurant_id,business_day_id, amount, reason)
        VALUES ($1,$2,$3,$4)
        RETURNING id
        `,
        [req.restaurantId,businessDayId, amount, "Staff Salary"]
      );

      withdrawalId = withdrawalRes.rows[0].id;

      await logEvent(client, {
  restaurantId: req.restaurantId,
  businessDayId,
  entityType: "cash",
  entityId: withdrawalId,
  eventType: "cash_withdrawal",
  amount: -amount,
  metadata: { reason: "Staff Salary" },
  userId: req.user.id
});
    }

    /* =========================
       INSERT TRANSACTION
    ========================= */
    const result = await client.query(
      `
      INSERT INTO staff_transactions
      (restaurant_id,staff_id, amount, type, reason, business_day_id, withdrawal_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [req.restaurantId,id, amount, type, reason || null, businessDayId || null, withdrawalId]
    );

    if (payment_method === "cash" && !deduct_from_galla) {
      await logEvent(client, {
        restaurantId: req.restaurantId,
        businessDayId,
        entityType: "cash",
        entityId: result.rows[0].id,
        eventType: "cash_withdrawal",
        amount: -amount,
        metadata: { reason: "Staff Salary (manual)" },
        userId: req.user.id
      });
    }

    /* =========================
       EXPENSE + BANK
    ========================= */
    if (type === "payment") {

      const expenseRes = await client.query(
        `
        INSERT INTO expenses
        (
          restaurant_id,business_day_id,amount,category,
          description,payment_method,user_id,partner_id,
          staff_id,is_paid,source
        )
        VALUES ($1,$2,$3,'salary','Salary payment',$4,$5,$6,$7,true,'staff_payment')
        RETURNING id
        `,
        [
          req.restaurantId,
          businessDayId,
          amount,
          payment_method,
          partnerId ? null : req.user.id,
          partnerId || null,
          id
        ]
      );

      if (["online", "card"].includes(payment_method)) {

        let bankRes = await client.query(
          `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
          [req.restaurantId]
        );
        if (!bankRes.rows.length) {
          bankRes = await client.query(
            `INSERT INTO bank_accounts (restaurant_id, name) VALUES ($1, 'Default Account') RETURNING id`,
            [req.restaurantId]
          );
        }
        const bankAccountId = bankRes.rows[0].id;
const expenseId = expenseRes.rows[0].id;

await bankWithEvent(client, {
  restaurantId: req.restaurantId,
  bankAccountId,
  amount,
  type: "debit",
  source: "staff_salary",
  referenceId: expenseId,
  createdBy: req.user.id
});
      }

      await client.query(
        `UPDATE staff_transactions SET expense_id=$1 WHERE id=$2`,
        [expenseRes.rows[0].id, result.rows[0].id]
      );
    }

    

    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    req.log?.error({ err }, "Staff operation failed");
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

/* ===============================
   ADD STAFF (ADMIN)
================================ */
router.post("/", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  const {
    name,
    role,
    phone,
    email,
    password,
    salary,
    joining_date,
    opening_balance
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Name, email & password required"
    });
  }

  try {
    await client.query("BEGIN");

    /* =========================
       CHECK USER DUPLICATE
    ========================= */
    const exists = await client.query(
      `
      SELECT 1 FROM users
      WHERE restaurant_id=$1 AND email=$2
      `,
      [req.restaurantId, email]
    );

    if (exists.rows.length) {
      throw new Error("Email already exists");
    }

    /* =========================
       CREATE USER 🔥
    ========================= */
    const hashed = await bcrypt.hash(password, 10);

    const userRes = await client.query(
      `
      INSERT INTO users
      (restaurant_id, name, email, password_hash, role)
      VALUES ($1,$2,$3,$4,'STAFF')
      RETURNING id
      `,
      [
        req.restaurantId,
        name,
        email.toLowerCase(),
        hashed
      ]
    );

    const userId = userRes.rows[0].id;

    /* =========================
       CREATE STAFF 🔥
    ========================= */
    const staffRes = await client.query(
      `
      INSERT INTO staff
      (restaurant_id, name, role, phone, salary, joining_date, user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        req.restaurantId,
        name,
        role || null,
        phone || null,
        salary || 0,
        joining_date || new Date(),
        userId
      ]
    );

    const staff = staffRes.rows[0];

    /* =========================
       OPENING BALANCE
    ========================= */
    if (opening_balance && Number(opening_balance) !== 0) {
      await client.query(
        `
        INSERT INTO staff_transactions
        (restaurant_id,staff_id, amount, type, reason)
        VALUES ($1,$2,$3,'adjustment','Opening Balance')
        `,
        [req.restaurantId, staff.id, opening_balance]
      );

      await logEvent(client, {
  restaurantId: req.restaurantId,
  businessDayId: null,
  entityType: "cash",
  entityId: staff.id,
  eventType: "opening_balance",
  amount: opening_balance,
  metadata: { type: "staff" },
  userId: req.user.id
});
    }

    await client.query("COMMIT");

    res.status(201).json(staff);

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* ===============================
   GET SINGLE STAFF
================================ */
router.get("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT s.*, u.email
      FROM staff s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id=$1 AND s.restaurant_id=$2
      `,
      [req.params.id, req.restaurantId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Staff not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    req.log.error({ err }, "Failed to fetch single staff");
    res.status(500).json({ message: "Failed to fetch staff" });
  }
});
/* ===============================
   UPDATE STAFF
================================ */
router.put("/:id", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  const { id } = req.params;
  const { name, role, phone, salary, joining_date, is_active, email, password } = req.body;

  try {
    await client.query("BEGIN");

    const staffRes = await client.query(
      `SELECT user_id FROM staff WHERE id=$1 AND restaurant_id=$2`,
      [id, req.restaurantId]
    );

    if (!staffRes.rows.length) {
      throw new Error("Staff not found");
    }

    const userId = staffRes.rows[0].user_id;

    /* =========================
       UPDATE STAFF
    ========================= */
    const updated = await client.query(
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

    /* =========================
       UPDATE LOGIN 🔥
    ========================= */
    if (userId && (email || password)) {

      let hashed = null;
      if (password) {
        hashed = await bcrypt.hash(password, 10);
      }

      await client.query(
        `
        UPDATE users
        SET email = COALESCE($1, email),
            password_hash = COALESCE($2, password_hash)
        WHERE id=$3
        `,
        [email || null, hashed, userId]
      );
    }

    await client.query("COMMIT");

    res.json(updated.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* ===============================
   SOFT DELETE STAFF
================================ */
router.delete("/:id", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const staff = await client.query(
      `SELECT user_id FROM staff WHERE id=$1 AND restaurant_id=$2`,
      [req.params.id, req.restaurantId]
    );

    if (!staff.rows.length) {
      throw new Error("Staff not found");
    }

    const userId = staff.rows[0].user_id;

    await client.query(
      `UPDATE staff SET is_active=FALSE WHERE id=$1 AND restaurant_id=$2`,
      [req.params.id, req.restaurantId]
    );

    if (userId) {
      await client.query(
        `DELETE FROM users WHERE id=$1`,
        [userId]
      );
    }

    await client.query("COMMIT");

    res.json({ message: "Staff removed" });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

export default router;