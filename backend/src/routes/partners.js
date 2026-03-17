import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================
   GET ALL PARTNERS
========================= */

router.get("/", authenticate, async (req, res) => {
  try {
    const { restaurantId } = req;

    const result = await pool.query(
      `
      SELECT *
      FROM partners
      WHERE restaurant_id = $1
      ORDER BY name
      `,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch partners error:", err);
    res.status(500).json({ message: "Failed to fetch partners" });
  }
});

/* =========================
   CREATE PARTNER
========================= */

router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req;
    const { name, phone, email, share_percent } = req.body;

    const result = await pool.query(
      `
      INSERT INTO partners
      (restaurant_id, name, phone, email, share_percent)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [restaurantId, name, phone, email, share_percent]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create partner error:", err);
    res.status(500).json({ message: "Failed to create partner" });
  }
});

/* =========================
   UPDATE PARTNER
========================= */

router.patch("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req;
    const { id } = req.params;

    const { name, phone, email, share_percent } = req.body;

    const result = await pool.query(
      `
      UPDATE partners
      SET name=$1, phone=$2, email=$3, share_percent=$4
      WHERE id=$5 AND restaurant_id=$6
      RETURNING *
      `,
      [name, phone, email, share_percent, id, restaurantId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update partner error:", err);
    res.status(500).json({ message: "Failed to update partner" });
  }
});

/* =========================
   DELETE PARTNER
========================= */

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req;
    const { id } = req.params;

    await pool.query(
      `
      DELETE FROM partners
      WHERE id=$1 AND restaurant_id=$2
      `,
      [id, restaurantId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Delete partner error:", err);
    res.status(500).json({ message: "Failed to delete partner" });
  }
});

/* =========================
   PARTNER LEDGER SUMMARY
========================= */

router.get("/ledger", authenticate, requireAdmin, async (req, res) => {
  try {

    const restaurantId = req.restaurantId;

    /* =========================
       TOTAL SALES
    ========================= */

    const salesRes = await pool.query(
      `
      SELECT COALESCE(SUM(total),0) AS total_sales
      FROM orders
      WHERE restaurant_id=$1
      `,
      [restaurantId]
    );

    const totalSales = Number(salesRes.rows[0].total_sales);


    /* =========================
       TOTAL EXPENSES
    ========================= */

    const expenseRes = await pool.query(
      `
      SELECT COALESCE(SUM(amount),0) AS total_expenses
      FROM expenses
      WHERE restaurant_id=$1
      `,
      [restaurantId]
    );

    const totalExpenses = Number(expenseRes.rows[0].total_expenses);


    /* =========================
       TOTAL PROFIT
    ========================= */

    const totalProfit = totalSales - totalExpenses;


    /* =========================
       PARTNER SUMMARY
    ========================= */

    const partnersRes = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.share_percent,

        COALESCE(d.total_deposits,0) AS deposits,
        COALESCE(w.total_withdrawals,0) AS withdrawals,
        COALESCE(e.total_expenses,0) AS expenses_paid

      FROM partners p

      LEFT JOIN (
        SELECT partner_id, SUM(amount) AS total_deposits
        FROM cash_deposits
        WHERE restaurant_id=$1
        GROUP BY partner_id
      ) d ON d.partner_id = p.id

      LEFT JOIN (
        SELECT partner_id, SUM(amount) AS total_withdrawals
        FROM cash_withdrawals
        WHERE restaurant_id=$1
        GROUP BY partner_id
      ) w ON w.partner_id = p.id

      LEFT JOIN (
        SELECT partner_id, SUM(amount) AS total_expenses
        FROM expenses
        WHERE restaurant_id=$1 AND is_paid = TRUE
        GROUP BY partner_id
      ) e ON e.partner_id = p.id

      WHERE p.restaurant_id=$1
      ORDER BY p.name
      `,
      [restaurantId]
    );


    /* =========================
       CALCULATE BALANCES
    ========================= */

    const partners = partnersRes.rows.map((p) => {

      const deposits = Number(p.deposits);
      const withdrawals = Number(p.withdrawals);
      const expensesPaid = Number(p.expenses_paid);
      const sharePercent = Number(p.share_percent);

      const profitShare = (totalProfit * sharePercent) / 100;

      const netBalance =
        deposits
        - withdrawals
        + expensesPaid
        + profitShare;

      return {
        id: p.id,
        name: p.name,
        share_percent: sharePercent,

        deposits,
        withdrawals,
        expenses_paid: expensesPaid,

        profit_share: profitShare,
        net_balance: netBalance
      };
    });


    /* =========================
       RESPONSE
    ========================= */

    res.json({
      total_sales: totalSales,
      total_expenses: totalExpenses,
      total_profit: totalProfit,
      partners
    });

  } catch (err) {
    console.error("Partner ledger error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   SINGLE PARTNER LEDGER
========================= */

router.get("/:id/ledger", authenticate, requireAdmin, async (req, res) => {
  try {

    const { restaurantId } = req;
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
FROM (

  SELECT
    created_at,
    'deposit' AS type,
    amount,
    reason::text,
    description
  FROM cash_deposits
  WHERE restaurant_id=$1
  AND partner_id=$2

  UNION ALL

  SELECT
  created_at,
  'withdrawal' AS type,
  -amount AS amount,
  reason::text,
  description
FROM cash_withdrawals
  WHERE restaurant_id=$1
  AND partner_id=$2

  UNION ALL

  SELECT
    created_at,
    'expense' AS type,
    amount,
    category::text AS reason,
    description
  FROM expenses
  WHERE restaurant_id=$1
  AND partner_id=$2
  AND is_paid = TRUE

) t
ORDER BY created_at DESC
      `,
      [restaurantId, id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Partner ledger history error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
export default router;