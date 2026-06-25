import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================
   GET ALL PARTNERS
========================================= */
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM partners WHERE restaurant_id=$1 ORDER BY name`,
      [req.restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch partners");
    res.status(500).json({ message: "Failed to fetch partners" });
  }
});

/* =========================================
   CREATE PARTNER
========================================= */
router.post("/", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { restaurantId, userId } = req;
    const { name, phone, email, share_percent, idempotencyKey } = req.body;

    if (!name) throw new Error("Name required");
    if (share_percent < 0 || share_percent > 100)
      throw new Error("Invalid share percent");

    if (!idempotencyKey) throw new Error("Idempotency required");

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM partners WHERE restaurant_id=$1 AND name=$2`,
      [restaurantId, name]
    );

    if (existing.rows.length) {
      throw new Error("Partner already exists");
    }

    const totalRes = await client.query(
  `SELECT COALESCE(SUM(share_percent),0) as total FROM partners WHERE restaurant_id=$1`,
  [restaurantId]
);

if (Number(totalRes.rows[0].total) + share_percent > 100) {
  throw new Error("Total partner share cannot exceed 100%");
}

    const result = await client.query(
      `
      INSERT INTO partners
      (restaurant_id, name, phone, email, share_percent)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [restaurantId, name, phone, email, share_percent]
    );

    await client.query("COMMIT");

    res.json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   UPDATE PARTNER
========================================= */
router.put("/:id", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { restaurantId, userId } = req;
    const { name, phone, email, share_percent } = req.body;

    if (share_percent < 0 || share_percent > 100)
      throw new Error("Invalid share percent");

    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE partners
      SET name=$1, phone=$2, email=$3, share_percent=$4
      WHERE id=$5 AND restaurant_id=$6
      RETURNING *
      `,
      [name, phone, email, share_percent, id, restaurantId]
    );

    await client.query("COMMIT");

    res.json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   DELETE PARTNER
========================================= */
router.delete("/:id", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { restaurantId, userId } = req;

    await client.query("BEGIN");

    // Clear FK references — use SAVEPOINTs so a missing column on any table
    // doesn't abort the whole transaction
    const fkTables = [
      "cash_withdrawals",
      "cash_deposits",
      "expenses",
      "vendor_settlements",
      "bank_transactions",
    ];
    for (const table of fkTables) {
      await client.query(`SAVEPOINT sp_${table}`);
      try {
        await client.query(
          `UPDATE ${table} SET partner_id = NULL WHERE partner_id = $1`,
          [id]
        );
        await client.query(`RELEASE SAVEPOINT sp_${table}`);
      } catch {
        await client.query(`ROLLBACK TO SAVEPOINT sp_${table}`);
      }
    }

    await client.query(
      `DELETE FROM partners WHERE id=$1 AND restaurant_id=$2`,
      [id, restaurantId]
    );

    await client.query("COMMIT");

    res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   PARTNER LEDGER SUMMARY (FIXED 🔥)
========================================= */
router.get("/ledger", authenticate, requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req;

    /* =========================
       SALES
    ========================= */
    const salesRes = await pool.query(`
      SELECT COALESCE(SUM(amount),0) as total
      FROM ledger_events
      WHERE restaurant_id=$1
      AND event_type='cash_sale'
    `, [restaurantId]);

    const totalSales = Number(salesRes.rows[0].total);

    /* =========================
       EXPENSES
    ========================= */
    const expenseRes = await pool.query(`
      SELECT COALESCE(SUM(amount),0) as total
      FROM ledger_events
      WHERE restaurant_id=$1
      AND event_type='cash_withdrawal'
    `, [restaurantId]);

    const totalExpenses = Math.abs(Number(expenseRes.rows[0].total));

    const totalProfit = totalSales - totalExpenses;

    /* =========================
       PARTNERS
    ========================= */
    const partnersRes = await pool.query(
      `SELECT id, name, share_percent FROM partners WHERE restaurant_id=$1`,
      [restaurantId]
    );

    const partners = [];

    for (const p of partnersRes.rows) {

      /* =========================
         DEPOSITS (partner → business)
      ========================= */
      const depositRes = await pool.query(`
        SELECT COALESCE(SUM(amount),0) as total
        FROM bank_transactions
        WHERE restaurant_id=$1
        AND partner_id=$2
        AND type='credit'
      `, [restaurantId, p.id]);

      const deposits = Number(depositRes.rows[0].total);

      /* =========================
         WITHDRAWALS (business → partner)
      ========================= */
      const withdrawRes = await pool.query(`
        SELECT COALESCE(SUM(amount),0) as total
        FROM cash_withdrawals
        WHERE restaurant_id=$1
        AND partner_id=$2
      `, [restaurantId, p.id]);

      const withdrawals = Number(withdrawRes.rows[0].total);

      /* =========================
         EXPENSES PAID BY PARTNER
      ========================= */
      const expensePaidRes = await pool.query(`
        SELECT COALESCE(SUM(amount),0) as total
        FROM expenses
        WHERE restaurant_id=$1
        AND partner_id=$2
        AND is_paid=TRUE
      `, [restaurantId, p.id]);

      const expensesPaid = Number(expensePaidRes.rows[0].total);

      /* =========================
         PROFIT SHARE
      ========================= */
      const profitShare = (totalProfit * p.share_percent) / 100;

      /* =========================
         NET BALANCE
      ========================= */
      const netBalance =
        deposits
        - withdrawals
        - expensesPaid
        + profitShare;

      partners.push({
        id: p.id,
        name: p.name,
        share_percent: p.share_percent,
        deposits,
        withdrawals,
        expenses_paid: expensesPaid,
        profit_share: profitShare,
        net_balance: netBalance
      });
    }

    res.json({
      total_sales: totalSales,
      total_expenses: totalExpenses,
      total_profit: totalProfit,
      partners
    });

  } catch (err) {
    req.log.error({ err }, "Ledger error");
    res.status(500).json({ message: "Ledger error" });
  }
});

/* =========================================
   SINGLE PARTNER HISTORY
========================================= */
router.get("/:id/ledger", authenticate, requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req;
    const { id } = req.params;

    const partnerRes = await pool.query(
      `SELECT name FROM partners WHERE id=$1 AND restaurant_id=$2`,
      [id, restaurantId]
    );
    const partnerName = partnerRes.rows[0]?.name ?? `Partner #${id}`;

    const result = await pool.query(
      `
      -- Cash withdrawals tagged to this partner
      SELECT
        'cash_withdrawal' AS event_type,
        cw.amount,
        cw.created_at,
        jsonb_build_object(
          'reason', cw.reason::text,
          'description', cw.description
        ) AS metadata
      FROM cash_withdrawals cw
      WHERE cw.restaurant_id = $1 AND cw.partner_id = $2

      UNION ALL

      -- Bank transactions tagged to this partner
      SELECT
        CASE WHEN bt.type = 'credit' THEN 'bank_deposit' ELSE 'bank_withdrawal' END,
        bt.amount,
        bt.created_at,
        jsonb_build_object('description', bt.description) AS metadata
      FROM bank_transactions bt
      WHERE bt.restaurant_id = $1 AND bt.partner_id = $2

      UNION ALL

      -- Expenses paid by / attributed to this partner
      SELECT
        'expense_paid' AS event_type,
        e.amount,
        COALESCE(e.paid_at, e.created_at) AS created_at,
        jsonb_build_object(
          'description', e.description,
          'category', e.category
        ) AS metadata
      FROM expenses e
      WHERE e.restaurant_id = $1 AND e.partner_id = $2 AND e.is_paid = TRUE

      ORDER BY created_at ASC
      `,
      [restaurantId, id]
    );

    const rows = result.rows.map(r => ({
      ...r,
      amount: Number(r.amount),
      partner_name: partnerName,
    }));

    res.json(rows);

  } catch (err) {
    req.log.error({ err }, "Ledger fetch failed");
    res.status(500).json({ message: "Ledger fetch failed" });
  }
});

export default router;