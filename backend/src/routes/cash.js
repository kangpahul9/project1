import express from "express";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import db from "../config/db.js";
import {
  normalizeDenominations,
  validateDenominations
} from "../utils/denominationUtils.js";

const router = express.Router();

/* =========================================
   GET CURRENT DRAWER CASH
========================================= */
router.get("/current", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId, businessDayId } = req;

    const result = await db.query(
      `
      SELECT note_value, SUM(quantity) as quantity
      FROM denominations
      WHERE restaurant_id = $1
      AND business_day_id = $2
      GROUP BY note_value
      ORDER BY note_value DESC
      `,
      [restaurantId, businessDayId]
    );

    const breakdown = result.rows.map(r => ({
      note_value: Number(r.note_value),
      quantity: Number(r.quantity)
    }));

    // 🔒 Use cents internally
    const totalCents = breakdown.reduce(
      (acc, row) =>
        acc + Math.round(Number(row.note_value) * 100) * Number(row.quantity),
      0
    );

    res.json({
      total: totalCents / 100,
      breakdown
    });

  } catch (err) {
    next(err);
  }
});

/* =========================================
   RECOUNT DRAWER CASH
========================================= */
router.post("/recount", authenticate, requireAdmin, async (req, res, next) => {
  const client = await db.connect();

  try {
    let { breakdown, idempotencyKey } = req.body;
    const { restaurantId, businessDayId, userId } = req;

    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      throw new Error("Breakdown required");
    }

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new Error("Idempotency key required");
    }

    // 🚫 prevent payload abuse
    if (breakdown.length > 50) {
      throw new Error("Too many denominations");
    }

    let denomMap = {};

    for (const d of breakdown) {
      const note = Number(d.note);
      const qty = Number(d.qty);

      if (!note || isNaN(qty) || qty < 0) {
        throw new Error("Invalid denomination values");
      }

      denomMap[note] = (denomMap[note] || 0) + qty;
    }

    // 🔒 normalize + validate
    denomMap = normalizeDenominations(
      denomMap,
      req.settings.currency.code
    );

    const totalCents = Object.entries(denomMap).reduce(
      (sum, [n, q]) => sum + Math.round(Number(n) * 100) * q,
      0
    );

    if (totalCents === 0) {
      throw new Error("Total cannot be zero");
    }

    validateDenominations(
      denomMap,
      totalCents / 100,
      req.settings.currency.code
    );

    await client.query("BEGIN");

    // 🔒 idempotency check
    const existing = await client.query(
      `
      SELECT id FROM cash_recounts
      WHERE restaurant_id=$1 AND idempotency_key=$2
      `,
      [restaurantId, idempotencyKey]
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.json({ message: "Already processed" });
    }

    // 🔒 lock current drawer
    await client.query(
      `
      SELECT 1 FROM denominations
      WHERE restaurant_id=$1 AND business_day_id=$2
      FOR UPDATE
      `,
      [restaurantId, businessDayId]
    );

    // 🔥 replace state
    await client.query(
      `DELETE FROM denominations
       WHERE restaurant_id=$1 AND business_day_id=$2`,
      [restaurantId, businessDayId]
    );

    for (const [note, qty] of Object.entries(denomMap)) {
      if (qty > 0) {
        await client.query(
          `
          INSERT INTO denominations
          (restaurant_id, business_day_id, note_value, quantity)
          VALUES ($1,$2,$3,$4)
          `,
          [restaurantId, businessDayId, note, qty]
        );
      }
    }

    // 🔥 audit log (fixed)
    await client.query(
      `
      INSERT INTO cash_recounts
      (restaurant_id, business_day_id, total, user_id, idempotency_key)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        restaurantId,
        businessDayId,
        totalCents / 100,
        userId,
        idempotencyKey
      ]
    );

    await client.query("COMMIT");

    req.log?.info(
      {
        restaurantId,
        businessDayId,
        total: totalCents / 100,
        userId
      },
      "Cash recount completed"
    );

    res.json({
      success: true,
      total: totalCents / 100
    });

  } catch (err) {
    await client.query("ROLLBACK");

    req.log?.error(err, "Cash recount failed");

    next(err);

  } finally {
    client.release();
  }
});

export default router;