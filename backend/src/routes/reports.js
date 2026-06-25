import express from "express";
import pool from "../config/db.js";
import { authenticate,requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================
   DAILY REPORT
========================================= */
router.get("/daily", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { date } = req.query;
    const { restaurantId } = req;

    if (!date) {
      return res.status(400).json({ message: "date required (YYYY-MM-DD)" });
    }

    const start = `${date} 00:00:00`;
    const end = `${date} 23:59:59`;

    /* =========================
       BUSINESS METRICS (ORDERS)
    ========================= */
    const ordersRes = await pool.query(
      `
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total),0) as total_sales,
        COUNT(*) FILTER (WHERE is_paid = true) as paid_orders,
        COUNT(*) FILTER (WHERE is_paid = false) as unpaid_orders,
        COALESCE(SUM(CASE WHEN payment_method = 'unpaid' THEN total ELSE 0 END),0) as total_credit_given,
        COALESCE(SUM(due_amount),0) as total_outstanding
      FROM orders
      WHERE restaurant_id=$1
      AND created_at >= $2
      AND created_at < $3
      AND is_deleted = FALSE
      `,
      [restaurantId, start, end]
    );

    /* =========================
       MONEY METRICS (LEDGER)
    ========================= */
    const ledgerRes = await pool.query(
      `
      SELECT
  COALESCE(SUM(CASE 
    WHEN entity_type='cash' AND event_type='cash_sale' 
    THEN amount ELSE 0 END),0) as total_cash,

  COALESCE(SUM(CASE 
    WHEN entity_type='bank' AND event_type='bank_credit' 
    THEN amount ELSE 0 END),0) as total_online,

  COALESCE(SUM(CASE 
    WHEN entity_type='cash' AND event_type='cash_refund' 
    THEN amount ELSE 0 END),0) as total_cash_refund,

  COALESCE(SUM(CASE 
    WHEN entity_type='bank' 
         AND event_type='bank_debit'
         AND metadata->>'source'='order_payment'
    THEN amount ELSE 0 END),0) as total_bank_refund

FROM ledger_events
WHERE restaurant_id=$1
AND created_at >= $2
AND created_at < $3
      `,
      [restaurantId, start, end]
    );

    const o = ordersRes.rows[0];
    const l = ledgerRes.rows[0];

    const totalRefunds =
      Math.abs(Number(l.total_cash_refund || 0)) +
      Math.abs(Number(l.total_bank_refund || 0));

    res.json({
      /* BUSINESS */
totalSales:
  Number(l.total_cash || 0) +
  Number(l.total_online || 0),
        totalOrders: Number(o.total_orders || 0),
      paidOrders: Number(o.paid_orders || 0),
      unpaidOrders: Number(o.unpaid_orders || 0),
      totalCreditGiven: Number(o.total_credit_given || 0),
      totalOutstanding: Number(o.total_outstanding || 0),

      /* MONEY */
      totalCash: Number(l.total_cash || 0),
      totalOnline: Number(l.total_online || 0),

      /* REFUNDS */
      totalRefunds,

      /* NET */
      netSales: Number(o.total_sales || 0) - totalRefunds
    });

  } catch (err) {
    next(err);
  }
});

router.get("/weekly", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;

    /* =========================
       SALES (ORDERS)
    ========================= */
    const sales = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        TO_CHAR(created_at, 'DD Mon') as label,
        COALESCE(SUM(total),0) as total_sales
      FROM orders
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '7 days'
      AND is_deleted = FALSE
      GROUP BY DATE(created_at), label
    `, [restaurantId]);

    /* =========================
       REFUNDS (LEDGER)
    ========================= */
    const refunds = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(
         CASE 
  WHEN entity_type='cash' AND event_type='cash_refund'
    THEN ABS(amount)

  WHEN entity_type='bank' 
       AND event_type='bank_debit'
       AND metadata->>'source'='order_payment'
    THEN ABS(amount)

  ELSE 0
END
        ),0) as refunds
      FROM ledger_events
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
    `, [restaurantId]);

    /* =========================
       MERGE DATA
    ========================= */
    const refundMap = {};
    for (const r of refunds.rows) {
      refundMap[r.date.toISOString().slice(0,10)] = Number(r.refunds);
    }

    const result = sales.rows.map(s => {
      const key = s.date.toISOString().slice(0,10);
      const refund = refundMap[key] || 0;

      return {
        date: s.label,
        totalSales: Number(s.total_sales),
        refunds: refund,
        netSales: Number(s.total_sales) - refund
      };
    });

    res.json(result);

  } catch (err) {
    next(err);
  }
});

router.get("/weekly-summary", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;

    /* =========================
       CURRENT WEEK (ORDERS)
    ========================= */
    const currentOrders = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total),0) as total_sales,
        COUNT(*) FILTER (WHERE is_paid = true) as paid_orders,
        COUNT(*) FILTER (WHERE is_paid = false) as unpaid_orders,
        COALESCE(SUM(CASE WHEN payment_method='unpaid' THEN total ELSE 0 END),0) as total_credit_given,
        COALESCE(SUM(due_amount),0) as total_outstanding
      FROM orders
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '7 days'
      AND is_deleted = FALSE
    `, [restaurantId]);

    /* =========================
       CURRENT WEEK (LEDGER)
    ========================= */
    const currentLedger = await pool.query(`
      SELECT
  COALESCE(SUM(CASE 
    WHEN entity_type='cash' AND event_type='cash_sale' 
    THEN amount ELSE 0 END),0) as total_cash,

  COALESCE(SUM(CASE 
    WHEN entity_type='bank' AND event_type='bank_credit' 
    THEN amount ELSE 0 END),0) as total_online,

  COALESCE(SUM(CASE 
    WHEN entity_type='cash' AND event_type='cash_refund' 
    THEN amount ELSE 0 END),0) as cash_refund,

  COALESCE(SUM(CASE 
    WHEN entity_type='bank' 
         AND event_type='bank_debit'
         AND metadata->>'source'='order_payment'
    THEN amount ELSE 0 END),0) as bank_refund

FROM ledger_events
WHERE restaurant_id=$1
AND created_at >= NOW() - INTERVAL '7 days'
    `, [restaurantId]);

    /* =========================
       PREVIOUS WEEK (ORDERS)
    ========================= */
    const previousOrders = await pool.query(`
      SELECT COALESCE(SUM(total),0) as total_sales
      FROM orders
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '14 days'
      AND created_at < NOW() - INTERVAL '7 days'
      AND is_deleted = FALSE
    `, [restaurantId]);

    /* =========================
       PREVIOUS WEEK (REFUNDS)
    ========================= */
    const previousRefunds = await pool.query(`
      SELECT COALESCE(SUM(ABS(amount)),0) as refunds
      FROM ledger_events
      WHERE restaurant_id=$1
      AND (
        (entity_type='cash' AND event_type='cash_refund')
        OR
        (entity_type='bank'
         AND event_type='bank_debit'
         AND metadata->>'source'='order_payment')
      )
      AND created_at >= NOW() - INTERVAL '14 days'
      AND created_at < NOW() - INTERVAL '7 days'
    `, [restaurantId]);

    const o = currentOrders.rows[0];
    const l = currentLedger.rows[0];

    const totalRefunds =
      Math.abs(Number(l.cash_refund || 0)) +
      Math.abs(Number(l.bank_refund || 0));

    const netSales = Number(o.total_sales || 0) - totalRefunds;

    const prevSales = Number(previousOrders.rows[0].total_sales || 0);
    const prevRefunds = Number(previousRefunds.rows[0].refunds || 0);
    const prevNet = prevSales - prevRefunds;

    let growth = 0;
    if (prevNet > 0) {
      growth = ((netSales - prevNet) / prevNet) * 100;
    }

    res.json({
      /* SALES */
      totalSales: Number(o.total_sales || 0),
      totalCash: Number(l.total_cash || 0),
      totalOnline: Number(l.total_online || 0),
      totalRefunds,
      netSales,

      /* BUSINESS */
      totalOrders: Number(o.total_orders || 0),
      paidOrders: Number(o.paid_orders || 0),
      unpaidOrders: Number(o.unpaid_orders || 0),
      totalCreditGiven: Number(o.total_credit_given || 0),
      totalOutstanding: Number(o.total_outstanding || 0),

      /* GROWTH */
      previousSales: prevNet,
      growthPercentage: Number(growth.toFixed(2))
    });

  } catch (err) {
    next(err);
  }
});


router.get("/monthly", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;

    /* =========================
       SALES (ORDERS)
    ========================= */
    const sales = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        TO_CHAR(created_at, 'DD Mon') as label,
        COALESCE(SUM(total),0) as total_sales
      FROM orders
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '30 days'
      AND is_deleted = FALSE
      GROUP BY DATE(created_at), label
    `, [restaurantId]);

    /* =========================
       REFUNDS (LEDGER)
    ========================= */
    const refunds = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(
          CASE 
  WHEN entity_type='cash' AND event_type='cash_refund'
    THEN ABS(amount)

  WHEN entity_type='bank' 
       AND event_type='bank_debit'
       AND metadata->>'source'='order_payment'
    THEN ABS(amount)

  ELSE 0
END
        ),0) as refunds
      FROM ledger_events
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
    `, [restaurantId]);

    /* =========================
       MERGE
    ========================= */
    const refundMap = {};
    for (const r of refunds.rows) {
      refundMap[r.date.toISOString().slice(0,10)] = Number(r.refunds);
    }

    const result = sales.rows.map(s => {
      const key = s.date.toISOString().slice(0,10);
      const refund = refundMap[key] || 0;

      return {
        date: s.label,
        totalSales: Number(s.total_sales),
        refunds: refund,
        netSales: Number(s.total_sales) - refund
      };
    });

    res.json(result);

  } catch (err) {
    next(err);
  }
});

router.get("/monthly-summary", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;

    /* =========================
       CURRENT MONTH (ORDERS)
    ========================= */
    const currentOrders = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total),0) as total_sales,
        COUNT(*) FILTER (WHERE is_paid = true) as paid_orders,
        COUNT(*) FILTER (WHERE is_paid = false) as unpaid_orders,
        COALESCE(SUM(CASE WHEN payment_method='unpaid' THEN total ELSE 0 END),0) as total_credit_given,
        COALESCE(SUM(due_amount),0) as total_outstanding
      FROM orders
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '30 days'
      AND is_deleted = FALSE
    `, [restaurantId]);

    /* =========================
       CURRENT MONTH (LEDGER)
    ========================= */
    const currentLedger = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN event_type='cash_sale' THEN amount ELSE 0 END),0) as total_cash,
        COALESCE(SUM(CASE WHEN event_type='bank_credit' THEN amount ELSE 0 END),0) as total_online,
        COALESCE(SUM(CASE WHEN event_type='cash_refund' THEN amount ELSE 0 END),0) as cash_refund,
        COALESCE(SUM(CASE WHEN event_type='bank_debit' THEN amount ELSE 0 END),0) as bank_refund
      FROM ledger_events
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '30 days'
    `, [restaurantId]);

    /* =========================
       PREVIOUS MONTH (ORDERS)
    ========================= */
    const previousOrders = await pool.query(`
      SELECT COALESCE(SUM(total),0) as total_sales
      FROM orders
      WHERE restaurant_id=$1
      AND created_at >= NOW() - INTERVAL '60 days'
      AND created_at < NOW() - INTERVAL '30 days'
      AND is_deleted = FALSE
    `, [restaurantId]);

    /* =========================
       PREVIOUS MONTH (REFUNDS)
    ========================= */
    const previousRefunds = await pool.query(`
      SELECT COALESCE(SUM(ABS(amount)),0) as refunds
      FROM ledger_events
      WHERE restaurant_id=$1
      AND (
        (entity_type='cash' AND event_type='cash_refund')
        OR
        (entity_type='bank'
         AND event_type='bank_debit'
         AND metadata->>'source'='order_payment')
      )
      AND created_at >= NOW() - INTERVAL '60 days'
      AND created_at < NOW() - INTERVAL '30 days'
    `, [restaurantId]);

    const o = currentOrders.rows[0];
    const l = currentLedger.rows[0];

    const totalRefunds =
      Math.abs(Number(l.cash_refund || 0)) +
      Math.abs(Number(l.bank_refund || 0));

    const netSales = Number(o.total_sales || 0) - totalRefunds;

    const prevSales = Number(previousOrders.rows[0].total_sales || 0);
    const prevRefunds = Number(previousRefunds.rows[0].refunds || 0);
    const prevNet = prevSales - prevRefunds;

    let growth = 0;
    if (prevNet > 0) {
      growth = ((netSales - prevNet) / prevNet) * 100;
    }

    res.json({
      /* SALES */
      totalSales: Number(o.total_sales || 0),
      totalCash: Number(l.total_cash || 0),
      totalOnline: Number(l.total_online || 0),
      totalRefunds,
      netSales,

      /* BUSINESS */
      totalOrders: Number(o.total_orders || 0),
      paidOrders: Number(o.paid_orders || 0),
      unpaidOrders: Number(o.unpaid_orders || 0),
      totalCreditGiven: Number(o.total_credit_given || 0),
      totalOutstanding: Number(o.total_outstanding || 0),

      /* GROWTH */
      previousSales: prevNet,
      growthPercentage: Number(growth.toFixed(2))
    });

  } catch (err) {
    next(err);
  }
});

router.get("/top-products", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;
    const { range = "7d", startDate, endDate } = req.query;

    let whereClause, params;
    if (range === "custom" && startDate && endDate) {
      whereClause = `AND o.created_at >= $2 AND o.created_at < ($3::date + INTERVAL '1 day')`;
      params = [restaurantId, startDate, endDate];
    } else {
      const interval = range === "30d" ? "30 days" : "7 days";
      whereClause = `AND o.created_at >= NOW() - INTERVAL '${interval}'`;
      params = [restaurantId];
    }

    const result = await pool.query(`
      SELECT
        oi.menu_item_id,
        oi.item_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.price_snapshot) as total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id=$1
      AND o.is_deleted=FALSE
      ${whereClause}
      GROUP BY oi.menu_item_id, oi.item_name
      ORDER BY total_quantity DESC
      LIMIT 10
    `, params);

    res.json(result.rows);

  } catch (err) {
    next(err);
  }
});

router.get("/product-analytics", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;
    const { query, range = "7d", startDate, endDate } = req.query;

    if (!query) {
      return res.status(400).json({ message: "query required" });
    }

    let whereClause, summaryParams, trendParams;
    const likeQuery = `%${query}%`;

    if (range === "custom" && startDate && endDate) {
      whereClause = `AND o.created_at >= $3 AND o.created_at < ($4::date + INTERVAL '1 day')`;
      summaryParams = [restaurantId, likeQuery, startDate, endDate];
      trendParams   = [restaurantId, likeQuery, startDate, endDate];
    } else {
      const interval = range === "30d" ? "30 days" : "7 days";
      whereClause = `AND o.created_at >= NOW() - INTERVAL '${interval}'`;
      summaryParams = [restaurantId, likeQuery];
      trendParams   = [restaurantId, likeQuery];
    }

    /* SUMMARY */
    const summary = await pool.query(`
      SELECT
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.price_snapshot) as total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id=$1
      AND o.is_deleted=FALSE
      AND oi.item_name ILIKE $2
      ${whereClause}
    `, summaryParams);

    /* TREND */
    const trend = await pool.query(`
      SELECT
        DATE(o.created_at) as date,
        SUM(oi.quantity) as qty,
        SUM(oi.quantity * oi.price_snapshot) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id=$1
      AND o.is_deleted=FALSE
      AND oi.item_name ILIKE $2
      ${whereClause}
      GROUP BY DATE(o.created_at)
      ORDER BY date
    `, trendParams);

    res.json({
      summary: summary.rows[0],
      trend: trend.rows
    });

  } catch (err) {
    next(err);
  }
});

router.get("/hourly", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;
    const { range = "7d", startDate, endDate } = req.query;

    let whereClause, params;
    if (range === "custom" && startDate && endDate) {
      whereClause = `AND o.created_at >= $2 AND o.created_at < ($3::date + INTERVAL '1 day')`;
      params = [restaurantId, startDate, endDate];
    } else {
      const interval = range === "30d" ? "30 days" : "7 days";
      whereClause = `AND o.created_at >= NOW() - INTERVAL '${interval}'`;
      params = [restaurantId];
    }

    const result = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM o.created_at) as hour,
        COUNT(*) as total_orders,
        COALESCE(SUM(o.total),0) as total_sales
      FROM orders o
      WHERE o.restaurant_id = $1
      AND o.is_deleted = FALSE
      ${whereClause}
      GROUP BY hour
      ORDER BY hour
    `, params);

    const data = result.rows.map(r => ({
      hour: Number(r.hour),
      orders: Number(r.total_orders),
      sales: Number(r.total_sales)
    }));

    /* =========================
       PEAK + WEAK
    ========================= */
    let peak = null;
    let weak = null;

    for (const d of data) {
      if (!peak || d.sales > peak.sales) peak = d;
      if (!weak || d.sales < weak.sales) weak = d;
    }

    res.json({
      hourly: data,
      peakHour: peak,
      weakestHour: weak
    });

  } catch (err) {
    next(err);
  }
});

router.get("/staff", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;
    const { range = "14d" } = req.query; // fortnight default

    let interval = "14 days";
    if (range === "7d") interval = "7 days";
    if (range === "30d") interval = "30 days";

    /* =========================
       HOURS
    ========================= */
    const hours = await pool.query(`
      SELECT
        sa.staff_id,
        SUM(EXTRACT(EPOCH FROM (sa.end_time - sa.start_time)) / 3600) as hours
      FROM shift_assignments sa
      WHERE sa.restaurant_id=$1
      AND sa.start_time >= NOW() - INTERVAL '${interval}'
      GROUP BY sa.staff_id
    `, [restaurantId]);

    /* =========================
       SALARY
    ========================= */
    const salary = await pool.query(`
      SELECT
        st.staff_id,
        SUM(st.amount) as paid
      FROM staff_transactions st
      WHERE st.restaurant_id=$1
      AND st.created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY st.staff_id
    `, [restaurantId]);

    /* =========================
       STAFF LIST
    ========================= */
    const staff = await pool.query(`
      SELECT id, name FROM staff
      WHERE restaurant_id=$1
    `, [restaurantId]);

    /* =========================
       MERGE
    ========================= */
    const hoursMap = {};
    for (const h of hours.rows) {
      hoursMap[h.staff_id] = Number(h.hours);
    }

    const salaryMap = {};
    for (const s of salary.rows) {
      salaryMap[s.staff_id] = Number(s.paid);
    }

    const result = staff.rows.map(s => {
      const hrs = hoursMap[s.id] || 0;
      const pay = salaryMap[s.id] || 0;

      return {
        staffId: s.id,
        name: s.name,
        hoursWorked: Number(hrs.toFixed(2)),
        salaryPaid: pay,
        costPerHour: hrs > 0 ? Number((pay / hrs).toFixed(2)) : 0
      };
    });

    res.json(result);

  } catch (err) {
    next(err);
  }
});

router.get("/export", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;
    const { module, range = "7d", startDate, endDate } = req.query;

    if (!module) {
      return res.status(400).json({ message: "module required" });
    }

    /* =========================
       RANGE HANDLER — always resolve to concrete timestamps
       so every query uses parameterized $2/$3 (no SQL interpolation)
    ========================= */
    let start, end;

    if (range === "custom") {
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate & endDate required" });
      }
      start = new Date(startDate);
      end   = new Date(endDate);
      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ message: "Invalid date format" });
      }
    } else {
      const days = range === "30d" ? 30 : 7;
      end   = new Date();
      start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    /* =========================
       CSV SAFE
    ========================= */
    const escapeCSV = (v) => {
      if (v === null || v === undefined) return "";
      return `"${String(v).replace(/"/g, '""')}"`;
    };

    let headers = [];
    let rows = [];

    /* =========================================
       MODULE SWITCH
    ========================================= */

    /* ========= ORDERS ========= */
    if (module === "orders") {
      const result = await pool.query(`
        SELECT bill_number, customer_name, payment_method, total, amount_paid, due_amount, created_at
        FROM orders
        WHERE restaurant_id=$1
        AND is_deleted = FALSE
        AND created_at >= $2
        AND created_at < $3
        ORDER BY created_at DESC
      `, [restaurantId, start, end]);

      headers = ["bill", "customer", "payment", "total", "paid", "due", "date"];

      rows = result.rows.map(o => [
        o.bill_number,
        o.customer_name,
        o.payment_method,
        o.total,
        o.amount_paid,
        o.due_amount,
        o.created_at
      ]);
    }

    /* ========= PRODUCTS ========= */
    else if (module === "products") {
      const result = await pool.query(`
        SELECT
          oi.item_name,
          SUM(oi.quantity) as qty,
          SUM(oi.quantity * oi.price_snapshot) as revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.restaurant_id=$1
        AND o.is_deleted=FALSE
        AND o.created_at >= $2
        AND o.created_at < $3
        GROUP BY oi.item_name
        ORDER BY qty DESC
      `, [restaurantId, start, end]);

      headers = ["product", "quantity", "revenue"];
      rows = result.rows.map(r => [r.item_name, r.qty, r.revenue]);
    }

    /* ========= HOURLY ========= */
    else if (module === "hourly") {
      const result = await pool.query(`
        SELECT
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as orders,
          SUM(total) as sales
        FROM orders
        WHERE restaurant_id=$1
        AND is_deleted=FALSE
        AND created_at >= $2
        AND created_at < $3
        GROUP BY hour
        ORDER BY hour
      `, [restaurantId, start, end]);

      headers = ["hour", "orders", "sales"];
      rows = result.rows.map(r => [r.hour, r.orders, r.sales]);
    }

    /* ========= STAFF ========= */
    else if (module === "staff") {
      const result = await pool.query(`
        SELECT
          s.name,
          SUM(sl.actual_hours) as hours,
          SUM(sl.total_earnings) as salary
        FROM shift_logs sl
        JOIN staff s ON s.id = sl.staff_id
        WHERE sl.restaurant_id=$1
        AND sl.created_at >= $2
        AND sl.created_at < $3
        GROUP BY s.name
      `, [restaurantId, start, end]);

      headers = ["staff", "hours", "salary"];
      rows = result.rows.map(r => [r.name, r.hours, r.salary]);
    }

    /* ========= REFUNDS ========= */
    else if (module === "refunds") {
      const result = await pool.query(`
        SELECT
          o.bill_number,
          r.amount,
          r.created_at
        FROM refunds r
        JOIN orders o ON o.id = r.order_id
        WHERE r.restaurant_id=$1
        AND r.created_at >= $2
        AND r.created_at < $3
      `, [restaurantId, start, end]);

      headers = ["bill", "refund_amount", "date"];
      rows = result.rows.map(r => [r.bill_number, r.amount, r.created_at]);
    }

    else {
      return res.status(400).json({ message: "invalid module" });
    }

    /* =========================
       BUILD CSV
    ========================= */
    const csv = [
      headers.join(","),
      ...rows.map(r => r.map(escapeCSV).join(","))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${module}_${range}.csv`
    );

    res.send(csv);

  } catch (err) {
    next(err);
  }
});


export default router;