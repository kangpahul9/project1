import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { sendDiscrepancyEmail } from "../utils/email.js";
import {
  validateDenominations
} from "../utils/denominationUtils.js";
import { logEvent } from "../utils/ledger.js";
import {
  closeBusinessDay,
  getDaySummary
} from "../services/businessDayService.js";

const router = express.Router();

/* ===============================
   GET CURRENT BUSINESS DAY
================================ */
router.get("/current", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM business_days
       WHERE restaurant_id=$1 AND is_closed=false
       ORDER BY id DESC LIMIT 1`,
      [req.restaurantId]
    );

    if (!result.rows.length) {
      return res.status(204).send();
    }

    res.json(result.rows[0]);

  } catch (err) {
    next(err);
  }
});

/* ===============================
   EXPECTED CASH
================================ */
router.get("/expected-cash", authenticate, async (req, res, next) => {
  try {
    const day = await pool.query(
      `SELECT id FROM business_days
       WHERE restaurant_id=$1 AND is_closed=false
       ORDER BY id DESC LIMIT 1`,
      [req.restaurantId]
    );

    if (!day.rows.length) {
      return res.status(404).json({
        message: "No open business day"
      });
    }

    const businessDayId = day.rows[0].id;

    const ledger = await pool.query(`
  SELECT COALESCE(SUM(amount),0) AS total
  FROM ledger_events
  WHERE restaurant_id=$1 
  AND business_day_id=$2
  AND entity_type='cash'
`, [req.restaurantId, businessDayId]);

    res.json({
      businessDayId,
      expectedCash: Number(ledger.rows[0].total),
    });

  } catch (err) {
    next(err);
  }
});

/* ===============================
   OPEN DAY
================================ */
router.post("/start", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    let { denominations } = req.body;

    if (!Array.isArray(denominations)) {
      throw new Error("Invalid denominations format");
    }

    await client.query("BEGIN");

    // 🔒 prevent race condition
    const existing = await client.query(
      `SELECT id FROM business_days
       WHERE restaurant_id=$1 AND is_closed=false
       FOR UPDATE`,
      [req.restaurantId]
    );

    if (existing.rows.length) {
      throw new Error("Business day already open");
    }

    // 🔒 validate + compute
    const toCents = (val) => Math.round(Number(val) * 100);

// 🔒 validate + compute (CENTS SAFE)
let openingCashCents = 0;
const normalized = {};

for (const d of denominations) {
  const note = Number(d.note);
  const qty = Number(d.qty);

  if (!note || isNaN(qty) || qty < 0) {
    throw new Error("Invalid denomination values");
  }

  normalized[note] = (normalized[note] || 0) + qty;

  openingCashCents += toCents(note) * qty;
}

const openingCash = openingCashCents / 100;

// 🔒 validate using decimal (your util expects decimal)
validateDenominations(
  normalized,
  openingCash,
  req.settings.currency.code
);

    // 🔥 create business day
    const day = await client.query(
      `INSERT INTO business_days
       (restaurant_id, date, is_closed, opening_cash, opened_by)
       VALUES ($1, CURRENT_DATE, false, $2, $3)
       RETURNING *`,
      [req.restaurantId, openingCash, req.userId]
    );

    const businessDay = day.rows[0];

    // 🔥 insert denominations
    for (const [note, qty] of Object.entries(normalized)) {
      if (qty > 0) {
        await client.query(
          `INSERT INTO denominations
           (restaurant_id, business_day_id, note_value, quantity)
           VALUES ($1,$2,$3,$4)`,
          [req.restaurantId, businessDay.id, note, qty]
        );
      }
    }

    // 🔥 ledger entry
    await logEvent(client, {
  restaurantId: req.restaurantId,
  businessDayId: businessDay.id,
  entityType: "cash",
  entityId: businessDay.id,
  eventType: "opening",
  amount: openingCash,
  metadata: { source: "business_day_start" },
  userId: req.userId
});

    // 🔥 get user name
    const userRes = await client.query(
      `SELECT name FROM users WHERE id=$1 AND restaurant_id=$2`,
      [req.userId, req.restaurantId]
    );

    const staffName = userRes.rows[0]?.name || "Unknown";

    await client.query("COMMIT");

    req.log?.info(
      { restaurantId: req.restaurantId },
      "Business day started"
    );

    res.status(201).json(businessDay);

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* ===============================
   CLOSE DAY
================================ */
router.post("/close", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    let { breakdown, total, reason } = req.body;

const totalCents = Math.round(Number(total) * 100);
const totalNum = totalCents / 100;

    if (!Array.isArray(breakdown) || isNaN(totalNum)) {
      throw new Error("Invalid closing data");
    }

    await client.query("BEGIN");

    const result = await closeBusinessDay({
      client,
      restaurantId: req.restaurantId,
      userId: req.userId,
      breakdown,
      total: totalNum,
      reason,
      currency: req.settings.currency.code
    });

    const summary = await getDaySummary(
      client,
      req.restaurantId,
      result.businessDayId
    );

    // 🔥 get user name
    const userRes = await client.query(
      `SELECT name FROM users WHERE id=$1 AND restaurant_id=$2`,
      [req.userId, req.restaurantId]
    );

    const staffName = userRes.rows[0]?.name || "Unknown";

    await client.query("COMMIT");

    if (result.hasDiscrepancy) {
      sendDiscrepancyEmail({
        userName: staffName,
        difference: result.difference,
        countedCash: totalNum,
        expectedCash: result.expectedCash,
        reason
      }).catch((err) => req.log.error({ err }, "Discrepancy email failed"));
    }

    req.log?.info(
      { restaurantId: req.restaurantId },
      "Business day closed"
    );

    res.json({
      message: "Business day closed successfully",
      expectedCash: result.expectedCash,
      difference: result.difference,
      ...summary
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

export default router;