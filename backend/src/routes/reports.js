import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================
   DAILY REPORT
========================================= */
router.get("/daily", authenticate, async (req, res) => {
  try {
    const { date } = req.query;

if (!date) {
  return res.status(400).json({ message: "date required (YYYY-MM-DD)" });
}

const salesRes = await pool.query(
  `
  SELECT
    COUNT(*) as total_orders,
    SUM(total) as total_sales,
    SUM(CASE WHEN is_paid = true THEN 1 ELSE 0 END) as paid_orders,
    SUM(CASE WHEN is_paid = false THEN 1 ELSE 0 END) as unpaid_orders,
    SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as total_cash,
    SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) as total_card,
    SUM(CASE WHEN payment_method = 'online' THEN total ELSE 0 END) as total_online,
    SUM(CASE WHEN payment_method = 'unpaid' THEN total ELSE 0 END) as total_credit_given,
    SUM(due_amount) as total_outstanding
  FROM orders
WHERE created_at >= $1::date
AND created_at < ($1::date + INTERVAL '1 day')  `,
  [date]
);

    const row = salesRes.rows[0];

    res.json({
      totalSales: Number(row.total_sales || 0),
      totalCash: Number(row.total_cash || 0),
      totalCard: Number(row.total_card || 0),
      totalOnline: Number(row.total_online || 0),
      totalCreditGiven: Number(row.total_credit_given || 0),
      totalOutstanding: Number(row.total_outstanding || 0),
      totalOrders: Number(row.total_orders || 0),
      paidOrders: Number(row.paid_orders || 0),
      unpaidOrders: Number(row.unpaid_orders || 0),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/weekly", authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
  TO_CHAR(created_at, 'DD Mon') as date,
  SUM(total) as total_sales
FROM orders
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), TO_CHAR(created_at, 'DD Mon')
ORDER BY DATE(created_at)
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/weekly-summary", authenticate, async (req, res) => {
  try {
    // Current week
    const currentWeek = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total) as total_sales,
        SUM(CASE WHEN is_paid = true THEN 1 ELSE 0 END) as paid_orders,
        SUM(CASE WHEN is_paid = false THEN 1 ELSE 0 END) as unpaid_orders,
        SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as total_cash,
        SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) as total_card,
        SUM(CASE WHEN payment_method = 'online' THEN total ELSE 0 END) as total_online,
        SUM(CASE WHEN payment_method = 'unpaid' THEN total ELSE 0 END) as total_credit_given,
        SUM(due_amount) as total_outstanding
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    // Previous week
    const previousWeek = await pool.query(`
      SELECT COALESCE(SUM(total),0) as total_sales
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '14 days'
      AND created_at < NOW() - INTERVAL '7 days'
    `);

    const row = currentWeek.rows[0];
    const currentSales = Number(row.total_sales || 0);
    const previousSales = Number(previousWeek.rows[0].total_sales || 0);

    let growth = 0;
    if (previousSales > 0) {
      growth = ((currentSales - previousSales) / previousSales) * 100;
    }

    res.json({
      totalSales: currentSales,
      totalCash: Number(row.total_cash || 0),
      totalCard: Number(row.total_card || 0),
      totalOnline: Number(row.total_online || 0),
      totalCreditGiven: Number(row.total_credit_given || 0),
      totalOutstanding: Number(row.total_outstanding || 0),
      totalOrders: Number(row.total_orders || 0),
      paidOrders: Number(row.paid_orders || 0),
      unpaidOrders: Number(row.unpaid_orders || 0),

      previousSales,
      growthPercentage: Number(growth.toFixed(2))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/monthly", authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
  TO_CHAR(created_at, 'DD Mon') as date,
  SUM(total) as total_sales
FROM orders
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), TO_CHAR(created_at, 'DD Mon')
ORDER BY DATE(created_at)
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/monthly-summary", authenticate, async (req, res) => {
  try {
    // Current month (last 30 days)
    const currentMonth = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total) as total_sales,
        SUM(CASE WHEN is_paid = true THEN 1 ELSE 0 END) as paid_orders,
        SUM(CASE WHEN is_paid = false THEN 1 ELSE 0 END) as unpaid_orders,
        SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as total_cash,
        SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) as total_card,
        SUM(CASE WHEN payment_method = 'online' THEN total ELSE 0 END) as total_online,
        SUM(CASE WHEN payment_method = 'unpaid' THEN total ELSE 0 END) as total_credit_given,
        SUM(due_amount) as total_outstanding
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // Previous month (30–60 days ago)
    const previousMonth = await pool.query(`
      SELECT COALESCE(SUM(total),0) as total_sales
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '60 days'
      AND created_at < NOW() - INTERVAL '30 days'
    `);

    const row = currentMonth.rows[0];
    const currentSales = Number(row.total_sales || 0);
    const previousSales = Number(previousMonth.rows[0].total_sales || 0);

    let growth = 0;
    if (previousSales > 0) {
      growth = ((currentSales - previousSales) / previousSales) * 100;
    }

    res.json({
      totalSales: currentSales,
      totalCash: Number(row.total_cash || 0),
      totalCard: Number(row.total_card || 0),
      totalOnline: Number(row.total_online || 0),
      totalCreditGiven: Number(row.total_credit_given || 0),
      totalOutstanding: Number(row.total_outstanding || 0),
      totalOrders: Number(row.total_orders || 0),
      paidOrders: Number(row.paid_orders || 0),
      unpaidOrders: Number(row.unpaid_orders || 0),

      previousSales,
      growthPercentage: Number(growth.toFixed(2))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/export", authenticate, async (req, res) => {
  try {
    const { type } = req.query; // daily | weekly | monthly

    let query = "";
    let filename = "report.csv";

    if (type === "daily") {
      filename = "daily_report.csv";

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
        ORDER BY created_at DESC
      `;
    }

    if (type === "weekly") {
      filename = "weekly_report.csv";

      query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_orders,
          SUM(total) as total_sales
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;
    }

    if (type === "monthly") {
      filename = "monthly_report.csv";

      query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_orders,
          SUM(total) as total_sales
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `;
    }

    const result = await pool.query(query);

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
