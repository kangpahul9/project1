import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";
import { randomUUID } from "crypto";
import { deductCash } from "../utils/cashUtils.js";
import { normalizeDenominations, validateDenominations } from "../utils/denominationUtils.js";
import { logEvent } from "../utils/ledger.js";

const router = express.Router();

const toDateStr = (d) => {
  if (!(d instanceof Date)) return String(d).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Determine effective rate based on day of week
function effectiveRate(payType, dateStr) {
  if (!payType) return 0;
  const dow = new Date(dateStr + "T00:00:00").getDay(); // 0=Sun, 6=Sat
  const isWeekend = dow === 0 || dow === 6;
  if (isWeekend && payType.weekend_rate) return Number(payType.weekend_rate);
  if (!isWeekend && payType.weekday_rate) return Number(payType.weekday_rate);
  return Number(payType.base_rate || 0);
}

/* =========================================
   GET PAYROLL SUMMARY
   GET /payroll?start=&end=&mode=roster|actual
========================================= */
router.get("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { start, end, mode = "roster" } = req.query;
    const { restaurantId } = req;

    if (!start || !end) throw new Error("start & end required");

    /* ── Fetch all shifts with staff and pay types ── */
    const shiftsRes = await pool.query(
      `
      SELECT
        s.id            AS shift_id,
        TO_CHAR(s.date, 'YYYY-MM-DD') AS date,
        s.shift_start,
        s.shift_end,
        s.pay_type_id,

        st.id           AS staff_id,
        st.name         AS staff_name,

        pt.name         AS pay_type_name,
        pt.base_rate,
        pt.weekday_rate,
        pt.weekend_rate,
        pt.holiday_rate,

        sl.actual_hours,
        sl.clock_in,
        sl.clock_out

      FROM shifts s
      JOIN shift_assignments sa ON sa.shift_id = s.id
      JOIN staff st ON st.id = sa.staff_id
      LEFT JOIN pay_types pt ON pt.id = s.pay_type_id
      LEFT JOIN LATERAL (
        SELECT actual_hours, clock_in, clock_out
        FROM shift_logs
        WHERE shift_id = s.id AND staff_id = st.id
        ORDER BY clock_in DESC LIMIT 1
      ) sl ON true

      WHERE s.restaurant_id = $1
        AND s.date BETWEEN $2 AND $3
        AND s.is_deleted = FALSE
      ORDER BY s.date ASC, st.name ASC
      `,
      [restaurantId, start, end]
    );

    /* ── Fetch already-paid amounts per (shift, staff) ── */
    const paidRes = await pool.query(
      `
      SELECT pe.shift_id, pe.staff_id,
             COALESCE(SUM(pe.amount), 0) AS paid_amount,
             COALESCE(SUM(pe.hours),  0) AS paid_hours
      FROM payroll_entries pe
      JOIN payroll_batches pb ON pb.id = pe.batch_id
      WHERE pe.restaurant_id = $1
        AND pe.status = 'paid'
      GROUP BY pe.shift_id, pe.staff_id
      `,
      [restaurantId]
    );

    const paidMap = {};
    for (const p of paidRes.rows) {
      paidMap[`${p.shift_id}_${p.staff_id}`] = {
        paid_amount: Number(p.paid_amount),
        paid_hours:  Number(p.paid_hours),
      };
    }

    /* ── Fetch outstanding advances per staff (net of repayments) ── */
    const advRes = await pool.query(
      `SELECT staff_id, COALESCE(SUM(amount), 0) AS advance_total
       FROM staff_advances
       WHERE restaurant_id=$1
       GROUP BY staff_id`,
      [restaurantId]
    );
    const advMap = {};
    for (const a of advRes.rows) advMap[a.staff_id] = Number(a.advance_total);

    /* ── Build result ── */
    const result = shiftsRes.rows.map((row) => {
      const dateStr = row.date;
      const dow = new Date(dateStr + "T00:00:00").getDay();
      const isWeekend = dow === 0 || dow === 6;

      /* roster hours */
      const shiftStartDt = new Date(`${dateStr}T${row.shift_start}`);
      const shiftEndDt   = new Date(`${dateStr}T${row.shift_end}`);
      const rosterHours  = Math.max(0, (shiftEndDt - shiftStartDt) / (1000 * 60 * 60));

      /* actual hours */
      const actualHours = Number(row.actual_hours || 0);

      const hours = mode === "actual" ? actualHours : rosterHours;

      const payType = row.pay_type_id ? {
        id:           row.pay_type_id,
        name:         row.pay_type_name,
        base_rate:    row.base_rate,
        weekday_rate: row.weekday_rate,
        weekend_rate: row.weekend_rate,
        holiday_rate: row.holiday_rate,
      } : null;

      const rate   = effectiveRate(payType, dateStr);
      const gross  = Number((hours * rate).toFixed(2));

      const key    = `${row.shift_id}_${row.staff_id}`;
      const paid   = paidMap[key] || { paid_amount: 0, paid_hours: 0 };

      return {
        shift_id:         Number(row.shift_id),
        staff_id:         Number(row.staff_id),
        staff_name:       row.staff_name,
        date:             dateStr,
        shift_start:      row.shift_start?.slice(0, 5),
        shift_end:        row.shift_end?.slice(0, 5),
        day_type:         isWeekend ? "weekend" : "weekday",
        roster_hours:     Number(rosterHours.toFixed(2)),
        actual_hours:     Number(actualHours.toFixed(2)),
        hours:            Number(hours.toFixed(2)),
        pay_type_id:      row.pay_type_id,
        pay_type_name:    row.pay_type_name || "—",
        rate,
        gross_amount:     gross,
        paid_amount:      paid.paid_amount,
        remaining:        Number(Math.max(0, gross - paid.paid_amount).toFixed(2)),
        outstanding_advance: advMap[row.staff_id] || 0,
        clocked_in:       !!row.clock_in,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   CASH ADVANCES
   POST   /payroll/advances
   GET    /payroll/advances
   DELETE /payroll/advances/:id
========================================= */
router.post("/advances", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { staff_id, amount, notes, deduct_from_galla, denominations } = req.body;
    const { restaurantId, userId } = req;
    const businessDayId = req.businessDayId;
    const amountNum = Number(amount);

    if (!staff_id || !amountNum || amountNum <= 0) throw new Error("staff_id and amount required");

    await client.query("BEGIN");

    // Galla deduction (cash till)
    if (deduct_from_galla) {
      if (!businessDayId) throw new Error("Business day not active");
      if (!denominations || typeof denominations !== "object") throw new Error("Denominations required");

      const currencyCode = req.settings?.currency?.code || req.settings?.currency_code || "AUD";
      const normalized = normalizeDenominations(denominations, currencyCode);
      validateDenominations(normalized, amountNum, currencyCode);

      await deductCash(client, restaurantId, businessDayId, normalized);

      const withdrawalRes = await client.query(
        `INSERT INTO cash_withdrawals (restaurant_id, business_day_id, amount, user_id, reason)
         VALUES ($1,$2,$3,$4,'Staff Advance') RETURNING id`,
        [restaurantId, businessDayId, amountNum, userId]
      );

      await logEvent(client, {
        restaurantId, businessDayId,
        entityType: "cash", entityId: withdrawalRes.rows[0].id,
        eventType: "cash_withdrawal", amount: -amountNum,
        metadata: { category: "salary", type: "staff_advance" }, userId,
      });
    }

    // Create expense record so it appears in the expenses list
    await client.query(
      `INSERT INTO expenses
         (restaurant_id, business_day_id, staff_id, amount, category, description,
          payment_method, user_id, is_paid, source, expense_date, idempotency_key)
       VALUES ($1,$2,$3,$4,'salary',$5,'cash',$6,true,'staff_advance',NOW(),$7)`,
      [
        restaurantId, businessDayId || null, staff_id, amountNum,
        notes ? `Cash advance: ${notes}` : "Cash advance",
        userId, randomUUID(),
      ]
    );

    // Create advance tracking record
    const r = await client.query(
      `INSERT INTO staff_advances (restaurant_id, staff_id, amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [restaurantId, staff_id, amountNum, notes || null, userId]
    );

    await client.query("COMMIT");
    res.json(r.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/advances", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { staff_id } = req.query;
    // Return individual positive advances for staff who still have net outstanding > 0
    // net_outstanding includes repayment rows (negative amounts)
    const r = await pool.query(
      `SELECT sa.*, st.name AS staff_name, net.net_outstanding
       FROM staff_advances sa
       JOIN staff st ON st.id = sa.staff_id
       JOIN (
         SELECT staff_id, COALESCE(SUM(amount), 0) AS net_outstanding
         FROM staff_advances
         WHERE restaurant_id=$1
         GROUP BY staff_id
       ) net ON net.staff_id = sa.staff_id
       WHERE sa.restaurant_id=$1
         AND sa.amount > 0
         AND sa.payroll_batch_id IS NULL
         AND ($2::bigint IS NULL OR sa.staff_id=$2)
         AND net.net_outstanding > 0
       ORDER BY sa.created_at DESC`,
      [req.restaurantId, staff_id || null]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.delete("/advances/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const r = await pool.query(
      `DELETE FROM staff_advances WHERE id=$1 AND restaurant_id=$2 AND payroll_batch_id IS NULL RETURNING id`,
      [req.params.id, req.restaurantId]
    );
    if (!r.rows.length) throw new Error("Advance not found or already settled");
    res.json({ message: "Advance cancelled" });
  } catch (err) { next(err); }
});

/* =========================================
   RECORD PAYMENT
   POST /payroll/pay
========================================= */
router.post("/pay", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    // advance_deductions: { [staff_id]: amount } — optional partial deductions
    const { entries, payment_method, notes, advance_deductions = {} } = req.body;
    const { restaurantId, userId } = req;

    if (!Array.isArray(entries) || entries.length === 0) throw new Error("No entries provided");
    if (!["paid", "xero"].includes(payment_method)) throw new Error("Invalid payment method");

    await client.query("BEGIN");

    /* ── Create batch ── */
    const batchRes = await client.query(
      `INSERT INTO payroll_batches (restaurant_id, status, payment_method, notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [restaurantId, payment_method === "xero" ? "pending" : "paid", payment_method, notes || null, userId]
    );
    const batchId = batchRes.rows[0].id;

    let inserted = 0;
    for (const e of entries) {
      const { shift_id, staff_id, hours, rate, amount } = e;
      if (!shift_id || !staff_id || !hours) continue;

      await client.query(
        `INSERT INTO payroll_entries
           (batch_id, restaurant_id, shift_id, staff_id, hours, rate, amount, status, payment_method, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          batchId, restaurantId, shift_id, staff_id,
          hours, rate || 0, amount || 0,
          payment_method === "xero" ? "pending" : "paid",
          payment_method,
          payment_method !== "xero" ? new Date() : null,
        ]
      );
      inserted++;
    }

    if (inserted === 0) {
      await client.query("ROLLBACK");
      throw new Error("All selected shifts are already fully paid");
    }

    // Record partial advance repayments as negative staff_advances rows
    for (const [staffIdStr, deductionAmt] of Object.entries(advance_deductions)) {
      const deduction = Number(deductionAmt);
      if (!deduction || deduction <= 0) continue;

      // Validate deduction doesn't exceed outstanding balance
      const balRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS balance
         FROM staff_advances WHERE restaurant_id=$1 AND staff_id=$2`,
        [restaurantId, Number(staffIdStr)]
      );
      const outstanding = Number(balRes.rows[0].balance);
      const capped = Math.min(deduction, outstanding);
      if (capped <= 0) continue;

      await client.query(
        `INSERT INTO staff_advances
           (restaurant_id, staff_id, amount, notes, payroll_batch_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [restaurantId, Number(staffIdStr), -capped, `Advance repayment — Payroll Batch #${batchId}`, batchId, userId]
      );
    }

    await client.query("COMMIT");

    res.json({
      message: payment_method === "xero"
        ? "Payroll batch queued for Xero"
        : "Payment recorded successfully",
      batch_id: batchId,
      entries_processed: inserted,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   GET PAYROLL BATCHES (HISTORY)
   GET /payroll/batches
========================================= */
router.get("/batches", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;
    const result = await pool.query(
      `
      SELECT
        pb.id,
        pb.status,
        pb.payment_method,
        pb.notes,
        pb.created_at,
        COUNT(pe.id)        AS entry_count,
        COALESCE(SUM(pe.amount), 0) AS total_amount
      FROM payroll_batches pb
      LEFT JOIN payroll_entries pe ON pe.batch_id = pb.id
      WHERE pb.restaurant_id = $1
      GROUP BY pb.id
      ORDER BY pb.created_at DESC
      LIMIT 30
      `,
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   UPDATE PAY TYPE RATES
   PUT /payroll/pay-types/:id/rates
========================================= */
router.put("/pay-types/:id/rates", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { weekday_rate, weekend_rate, holiday_rate } = req.body;
    const result = await pool.query(
      `UPDATE pay_types
       SET weekday_rate = $1, weekend_rate = $2, holiday_rate = $3
       WHERE id = $4 AND restaurant_id = $5
       RETURNING *`,
      [weekday_rate || null, weekend_rate || null, holiday_rate || null, id, req.restaurantId]
    );
    if (!result.rows.length) throw new Error("Pay type not found");
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
