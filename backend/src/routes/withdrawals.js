import express from "express";
import pool from "../config/db.js";
import { authenticate,requireAdmin } from "../middleware/authMiddleware.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";
import { getAllowedDenominations } from "../config/denominations.js";
import { normalizeDenominations } from "../utils/denominationUtils.js";

const router = express.Router();



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


async function logEvent(client, {
  restaurantId,
  businessDayId,
  entityType,
  entityId,
  eventType,
  amount,
  metadata = {},
  userId
}) {
  await client.query(
    `
    INSERT INTO ledger_events
    (restaurant_id, business_day_id, entity_type, entity_id, event_type, amount, metadata, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      restaurantId,
      businessDayId,
      entityType,
      entityId,
      eventType,
      amount,
      metadata,
      userId
    ]
  );
}
/* =========================================
   OWNER CASH WITHDRAWAL
========================================= */

router.post("/", authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { breakdown, reason, description, partnerId } = req.body;
    const businessDayId = req.businessDayId;

    if (req.settings.use_business_day && !req.businessDayId) {
  throw new Error("Business day not active");
}

    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      return res.status(400).json({ message: "Invalid breakdown" });
    }

    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ message: "Invalid reason" });
    }

    if (reason === "Other" && !description?.trim()) {
      return res.status(400).json({
        message: "Description required for 'Other'"
      });
    }

    const allowedDenoms = getAllowedDenominations(req.settings.currency.code);

    await client.query("BEGIN");

    /* 🔒 LOCK DRAWER */
    const drawerRes = await client.query(
      `
      SELECT note_value, quantity
      FROM denominations
      WHERE restaurant_id=$1 AND business_day_id=$2
      FOR UPDATE
      `,
      [req.restaurantId, businessDayId]
    );

    if (!drawerRes.rows.length) {
      throw new Error("Drawer not initialized");
    }

    /* 🧠 CREATE DB MAP */
    const denomMap = new Map(
      drawerRes.rows.map(r => [Number(r.note_value), Number(r.quantity)])
    );

    /* 🔥 NORMALIZE INPUT */
    let inputMap = {};
    for (const d of breakdown) {
      inputMap[d.note] = (inputMap[d.note] || 0) + d.qty;
    }

    inputMap = normalizeDenominations(
      inputMap,
      req.settings.currency.code
    );

    /* 🧮 CALCULATE TOTAL */
    let withdrawalTotal = 0;

    for (const [note, qty] of Object.entries(inputMap)) {
      const n = Number(note);
      const q = Number(qty);

      if (!allowedDenoms.includes(n)) {
        throw new Error(`Invalid denomination ${n}`);
      }

      if (q <= 0) continue;

      const available = denomMap.get(n);

      if (available === undefined) {
        throw new Error(`No ${n} notes found`);
      }

      if (q > available) {
        throw new Error(`Insufficient ${n}`);
      }

      withdrawalTotal += n * q;
    }

    if (withdrawalTotal <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    /* 🛡️ EXTRA SAFETY */
    let drawerTotal = 0;
    for (const row of drawerRes.rows) {
      drawerTotal += Number(row.note_value) * Number(row.quantity);
    }

    if (withdrawalTotal > drawerTotal) {
      throw new Error("Insufficient drawer balance");
    }

    /* 💸 DEDUCT CASH */
    for (const [note, qty] of Object.entries(inputMap)) {
      if (qty <= 0) continue;

      await client.query(
        `
        UPDATE denominations
        SET quantity = quantity - $1
        WHERE restaurant_id=$2 AND business_day_id=$3 AND note_value=$4
        `,
        [qty, req.restaurantId, businessDayId, note]
      );
    }

    /* 📝 INSERT WITHDRAWAL */
    const withdrawal = await client.query(
      `
      INSERT INTO cash_withdrawals
      (restaurant_id,business_day_id,amount,user_id,partner_id,reason,description)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
      `,
      [
        req.restaurantId,
        businessDayId,
        withdrawalTotal,
        partnerId ? null : req.user.id,
        partnerId || null,
        reason,
        description?.trim() || null
      ]
    );

    const withdrawalId = withdrawal.rows[0].id;

    /* 📊 LEDGER */
   await logEvent(client, {
  restaurantId: req.restaurantId,
  businessDayId,
  entityType: "cash",
  entityId: withdrawalId,
  eventType: "cash_withdrawal",
  amount: -withdrawalTotal,
  metadata: {
    reason,
    partnerId: partnerId || null
  },
  userId: req.user.id
});

    /* 💼 AUTO EXPENSE */
    if (EXPENSE_REASONS.includes(reason)) {
      await client.query(
        `
        INSERT INTO expenses
        (restaurant_id,business_day_id,amount,category,description,payment_method,user_id,partner_id)
        VALUES ($1,$2,$3,$4,$5,'cash',$6,$7)
        `,
        [
          req.restaurantId,
          businessDayId,
          withdrawalTotal,
          reason,
          description?.trim() || null,
          partnerId ? null : req.user.id,
          partnerId || null
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
    const isDbError = err.code && /^[0-9A-Z]{5}$/.test(err.code);
    res.status(isDbError ? 500 : 400).json({
      message: isDbError ? "Server error" : err.message,
    });
  } finally {
    client.release();
  }
});

/* =========================================
   WITHDRAWAL HISTORY (GLOBAL + FILTERABLE)
========================================= */
router.get("/history", authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      from,
      to,
      reason,
      partnerId,
      limit = 50,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        cw.*,
        u.name AS user_name,
        p.name AS partner_name,
        COALESCE(p.name, u.name) AS owner_name
      FROM cash_withdrawals cw
      LEFT JOIN users u 
        ON cw.user_id = u.id AND u.restaurant_id = $1
      LEFT JOIN partners p 
        ON cw.partner_id = p.id AND p.restaurant_id = $1
      WHERE cw.restaurant_id = $1
    `;

    const values = [req.restaurantId];
    let index = 2;

    /* =========================
       DATE FILTERS
    ========================= */
    if (from) {
      query += ` AND cw.created_at >= $${index++}`;
      values.push(from);
    }

    if (to) {
      query += ` AND cw.created_at <= $${index++}`;
      values.push(`${to} 23:59:59`);
    }

    /* =========================
       REASON FILTER
    ========================= */
    if (reason) {
      query += ` AND cw.reason = $${index++}`;
      values.push(reason);
    }

    /* =========================
       PARTNER FILTER
    ========================= */
    if (partnerId) {
      query += ` AND cw.partner_id = $${index++}`;
      values.push(partnerId);
    }

    /* =========================
       ORDER + PAGINATION
    ========================= */
    query += ` ORDER BY cw.created_at DESC LIMIT $${index++} OFFSET $${index++}`;
    values.push(Number(limit), Number(offset));

    const result = await pool.query(query, values);

    res.json({
      data: result.rows,
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });

  } catch (err) {
    req.log.error({ err }, "Failed to fetch withdrawals");
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});

router.post("/deposit", authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { breakdown, reason, partnerId } = req.body;
    const businessDayId = req.businessDayId;

    if (!businessDayId) {
      return res.status(400).json({ message: "Business day not active" });
    }

    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      return res.status(400).json({ message: "Invalid breakdown" });
    }

    const allowedDenoms = getAllowedDenominations(req.settings.currency.code);

    await client.query("BEGIN");

    /* 🔥 NORMALIZE INPUT */
    let inputMap = {};
    for (const d of breakdown) {
      inputMap[d.note] = (inputMap[d.note] || 0) + d.qty;
    }

    inputMap = normalizeDenominations(
      inputMap,
      req.settings.currency.code
    );

    /* 🧮 CALCULATE TOTAL */
    let totalAmount = 0;

    for (const [note, qty] of Object.entries(inputMap)) {
      const n = Number(note);
      const q = Number(qty);

      if (!allowedDenoms.includes(n)) {
        throw new Error(`Invalid denomination ${n}`);
      }

      if (q <= 0) continue;

      totalAmount += n * q;
    }

    if (totalAmount <= 0) {
      throw new Error("Deposit amount must be greater than 0");
    }

    /* 💰 ADD CASH (upsert — works even on a fresh drawer) */
    for (const [note, qty] of Object.entries(inputMap)) {
      if (qty <= 0) continue;

      await client.query(
        `
        INSERT INTO denominations
        (restaurant_id, business_day_id, note_value, quantity)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (restaurant_id, business_day_id, note_value)
        DO UPDATE SET quantity = denominations.quantity + EXCLUDED.quantity
        `,
        [req.restaurantId, businessDayId, note, qty]
      );
    }

    /* 📝 INSERT DEPOSIT */
    const deposit = await client.query(
      `
      INSERT INTO cash_deposits
      (restaurant_id,business_day_id,amount,user_id,partner_id,reason)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
      `,
      [
        req.restaurantId,
        businessDayId,
        totalAmount,
        partnerId ? null : req.user.id,
        partnerId || null,
        reason || "Drawer Refill"
      ]
    );

    const depositId = deposit.rows[0].id;

    /* 📊 LEDGER (FIXED TYPE) */
    await logEvent(client, {
  restaurantId: req.restaurantId,
  businessDayId,
  entityType: "cash",
  entityId: depositId,
  eventType: "cash_deposit",
  amount: totalAmount,
  metadata: {
    reason: reason || "Drawer Refill",
    partnerId: partnerId || null
  },
  userId: req.user.id
});

    await client.query("COMMIT");

    res.json({
      message: "Deposit successful",
      totalAmount
    });

  } catch (err) {
    await client.query("ROLLBACK");
    const isDbError = err.code && /^[0-9A-Z]{5}$/.test(err.code);
    res.status(isDbError ? 500 : 400).json({
      message: isDbError ? "Server error" : err.message,
    });
  } finally {
    client.release();
  }
});

router.get("/deposits-history", authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      from,
      to,
      partnerId,
      limit = 50,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        cd.*,
        u.name AS user_name,
        p.name AS partner_name,
        COALESCE(p.name, u.name) AS owner_name
      FROM cash_deposits cd
      LEFT JOIN users u 
        ON cd.user_id = u.id AND u.restaurant_id = $1
      LEFT JOIN partners p 
        ON cd.partner_id = p.id AND p.restaurant_id = $1
      WHERE cd.restaurant_id = $1
    `;

    const values = [req.restaurantId];
    let index = 2;

    /* =========================
       DATE FILTERS
    ========================= */
    if (from) {
      query += ` AND cd.created_at >= $${index++}`;
      values.push(from);
    }

    if (to) {
      query += ` AND cd.created_at <= $${index++}`;
      values.push(`${to} 23:59:59`);
    }

    /* =========================
       PARTNER FILTER
    ========================= */
    if (partnerId) {
      query += ` AND cd.partner_id = $${index++}`;
      values.push(partnerId);
    }

    /* =========================
       ORDER + PAGINATION
    ========================= */
    query += ` ORDER BY cd.created_at DESC LIMIT $${index++} OFFSET $${index++}`;
    values.push(Number(limit), Number(offset));

    const result = await pool.query(query, values);

    res.json({
      data: result.rows,
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });

  } catch (err) {
    req.log.error({ err }, "Failed to fetch deposit history");
    res.status(500).json({ message: "Failed to fetch deposit history" });
  }
});


export default router;
