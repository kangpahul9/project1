import express from "express";
import pool from "../config/db.js";
import { authenticate,requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================
   DAILY REPORT
========================================= */
router.get("/daily", authenticate,requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;

if (!date) {
  return res.status(400).json({ message: "date required (YYYY-MM-DD)" });
}

// ORDERS QUERY
const ordersRes = await pool.query(`
SELECT
  COUNT(*) as total_orders,
  SUM(total) as total_sales,
  COUNT(*) FILTER (WHERE is_paid = true) as paid_orders,
  COUNT(*) FILTER (WHERE is_paid = false) as unpaid_orders,
  SUM(CASE WHEN payment_method = 'unpaid' THEN total ELSE 0 END) as total_credit_given,
  SUM(due_amount) as total_outstanding
FROM orders
WHERE restaurant_id=$1
AND created_at >= $2::date 
AND created_at < ($2::date + INTERVAL '1 day')
AND is_deleted = FALSE
`, [req.restaurantId, date]);

// PAYMENTS QUERY
const paymentsRes = await pool.query(`
SELECT
  SUM(CASE WHEN op.payment_method = 'cash' THEN op.amount ELSE 0 END) as total_cash,
  SUM(CASE WHEN op.payment_method = 'card' THEN op.amount ELSE 0 END) as total_card,
  SUM(CASE WHEN op.payment_method = 'online' THEN op.amount ELSE 0 END) as total_online
FROM order_payments op
JOIN orders o ON o.id = op.order_id
WHERE op.restaurant_id=$1
AND o.is_deleted = FALSE
AND op.created_at >= $2::date 
AND op.created_at < ($2::date + INTERVAL '1 day')
`, [req.restaurantId, date]);

const o = ordersRes.rows[0];
const p = paymentsRes.rows[0];

res.json({
  totalSales: Number(o.total_sales || 0),
  totalCash: Number(p.total_cash || 0),
  totalCard: Number(p.total_card || 0),
  totalOnline: Number(p.total_online || 0),
  totalCreditGiven: Number(o.total_credit_given || 0),
  totalOutstanding: Number(o.total_outstanding || 0),
  totalOrders: Number(o.total_orders || 0),
  paidOrders: Number(o.paid_orders || 0),
  unpaidOrders: Number(o.unpaid_orders || 0),
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/weekly", authenticate,requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
  TO_CHAR(created_at, 'DD Mon') as date,
  SUM(total) as total_sales
FROM orders
WHERE restaurant_id=$1 
AND created_at >= NOW() - INTERVAL '7 days'
AND is_deleted = FALSE
GROUP BY DATE(created_at), TO_CHAR(created_at, 'DD Mon')
ORDER BY DATE(created_at)
    `,[req.restaurantId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/weekly-summary", authenticate, requireAdmin,async (req, res) => {
  try {
    // Current week
    // ORDERS
const currentWeekOrders = await pool.query(`
SELECT
  COUNT(*) as total_orders,
  SUM(total) as total_sales,
  COUNT(*) FILTER (WHERE is_paid = true) as paid_orders,
  COUNT(*) FILTER (WHERE is_paid = false) as unpaid_orders,
  SUM(CASE WHEN payment_method = 'unpaid' THEN total ELSE 0 END) as total_credit_given,
  SUM(due_amount) as total_outstanding
FROM orders o
WHERE o.restaurant_id=$1
AND o.created_at >= NOW() - INTERVAL '7 days'
AND o.is_deleted = FALSE
`, [req.restaurantId]);

// PAYMENTS
const currentWeekPayments = await pool.query(`
SELECT
  SUM(CASE WHEN op.payment_method = 'cash' THEN op.amount ELSE 0 END) as total_cash,
  SUM(CASE WHEN op.payment_method = 'card' THEN op.amount ELSE 0 END) as total_card,
  SUM(CASE WHEN op.payment_method = 'online' THEN op.amount ELSE 0 END) as total_online
FROM order_payments op
JOIN orders o ON o.id = op.order_id
WHERE op.restaurant_id=$1
AND o.is_deleted = FALSE
AND op.created_at >= NOW() - INTERVAL '7 days'
`, [req.restaurantId]);

    // Previous week
    const previousWeek = await pool.query(`
      SELECT COALESCE(SUM(total),0) as total_sales
      FROM orders
      WHERE restaurant_id=$1 AND created_at >= NOW() - INTERVAL '14 days'
      AND created_at < NOW() - INTERVAL '7 days'
    `,[req.restaurantId]);

   const o = currentWeekOrders.rows[0];
const p = currentWeekPayments.rows[0];
    const currentSales = Number(o.total_sales || 0);
    const previousSales = Number(previousWeek.rows[0].total_sales || 0);


    let growth = 0;
    if (previousSales > 0) {
      growth = ((currentSales - previousSales) / previousSales) * 100;
    }

    res.json({
  totalSales: Number(o.total_sales || 0),
  totalCash: Number(p.total_cash || 0),
  totalCard: Number(p.total_card || 0),
  totalOnline: Number(p.total_online || 0),
  totalCreditGiven: Number(o.total_credit_given || 0),
  totalOutstanding: Number(o.total_outstanding || 0),
  totalOrders: Number(o.total_orders || 0),
  paidOrders: Number(o.paid_orders || 0),
  unpaidOrders: Number(o.unpaid_orders || 0),

  previousSales,
  growthPercentage: Number(growth.toFixed(2))
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/monthly", authenticate,requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
  TO_CHAR(created_at, 'DD Mon') as date,
  SUM(total) as total_sales
FROM orders
WHERE restaurant_id=$1 
AND created_at >= NOW() - INTERVAL '30 days'
AND is_deleted = FALSE
GROUP BY DATE(created_at), TO_CHAR(created_at, 'DD Mon')
ORDER BY DATE(created_at)
    `,[req.restaurantId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/monthly-summary", authenticate,requireAdmin, async (req, res) => {
  try {
    // Current month (last 30 days)
    // ORDERS
const currentMonthOrders = await pool.query(`
SELECT
  COUNT(*) as total_orders,
  SUM(total) as total_sales,
  COUNT(*) FILTER (WHERE is_paid = true) as paid_orders,
  COUNT(*) FILTER (WHERE is_paid = false) as unpaid_orders,
  SUM(CASE WHEN payment_method = 'unpaid' THEN total ELSE 0 END) as total_credit_given,
  SUM(due_amount) as total_outstanding
FROM orders
WHERE restaurant_id=$1
AND created_at >= NOW() - INTERVAL '30 days'
AND is_deleted = FALSE
`, [req.restaurantId]);

// PAYMENTS
const currentMonthPayments = await pool.query(`
SELECT
  SUM(CASE WHEN op.payment_method = 'cash' THEN op.amount ELSE 0 END) as total_cash,
  SUM(CASE WHEN op.payment_method = 'card' THEN op.amount ELSE 0 END) as total_card,
  SUM(CASE WHEN op.payment_method = 'online' THEN op.amount ELSE 0 END) as total_online
FROM order_payments op
JOIN orders o ON o.id = op.order_id
WHERE op.restaurant_id=$1
AND o.is_deleted = FALSE
AND op.created_at >= NOW() - INTERVAL '30 days'
`, [req.restaurantId]);

    // Previous month (30–60 days ago)
    const previousMonth = await pool.query(`
      SELECT COALESCE(SUM(total),0) as total_sales
      FROM orders
      WHERE restaurant_id=$1 AND created_at >= NOW() - INTERVAL '60 days'
      AND created_at < NOW() - INTERVAL '30 days'
    `,[req.restaurantId]);

    const o = currentMonthOrders.rows[0];
const p = currentMonthPayments.rows[0];
   const currentSales = Number(o.total_sales || 0);
    const previousSales = Number(previousMonth.rows[0].total_sales || 0);

    let growth = 0;
    if (previousSales > 0) {
      growth = ((currentSales - previousSales) / previousSales) * 100;
    }

    res.json({
  totalSales: Number(o.total_sales || 0),
  totalCash: Number(p.total_cash || 0),
  totalCard: Number(p.total_card || 0),
  totalOnline: Number(p.total_online || 0),
  totalCreditGiven: Number(o.total_credit_given || 0),
  totalOutstanding: Number(o.total_outstanding || 0),
  totalOrders: Number(o.total_orders || 0),
  paidOrders: Number(o.paid_orders || 0),
  unpaidOrders: Number(o.unpaid_orders || 0),

  previousSales,
  growthPercentage: Number(growth.toFixed(2))
});

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/export", authenticate,requireAdmin, async (req, res) => {


  try {
    const { type } = req.query; // daily | weekly | monthly

    let query = "";
    let filename = "report.csv";

   let params = [];

  if (!type) {
  return res.status(400).json({ message: "type required (daily | weekly | monthly)" });
}

if (type === "daily") {

query = `
SELECT
id,
bill_number,
customer_name,
payment_method,
total,
amount_paid,
due_amount,
created_at
FROM orders
WHERE restaurant_id=$1
AND is_deleted = FALSE
ORDER BY created_at DESC
`;

params = [req.restaurantId];

}


    if (type === "weekly") {
      filename = "weekly_report.csv";

      query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_orders,
          SUM(total) as total_sales
        FROM orders
        WHERE restaurant_id=$1 AND created_at >= NOW() - INTERVAL '7 days' AND is_deleted = FALSE
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;params = [req.restaurantId]
    }

    if (type === "monthly") {
      filename = "monthly_report.csv";

      query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_orders,
          SUM(total) as total_sales
        FROM orders
        WHERE restaurant_id=$1 AND created_at >= NOW() - INTERVAL '30 days' AND is_deleted = FALSE
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;params=[req.restaurantId];
    }

const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No data found" });
    }

    // Convert rows to CSV
    const headers = Object.keys(result.rows[0]);
    const csvRows = [
      headers.join(","), // header row
      ...result.rows.map(row =>
        headers.map(field => `"${row[field] ?? ""}"`).join(",")
      )
    ];

    const csvData = csvRows.join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    res.send(csvData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "CSV export failed" });
  }
});



export default router;