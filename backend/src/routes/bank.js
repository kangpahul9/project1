import express from "express";
import pool from "../config/db.js";
import { authenticate,requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();


// =========================================
// GET SYSTEM SETTINGS
// =========================================
router.get("/balance", authenticate, requireAdmin, async (req, res) => {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(
      CASE
        WHEN type = 'credit' THEN amount
        WHEN type = 'debit' THEN -amount
      END
    ),0) AS balance
    FROM bank_transactions
    WHERE restaurant_id = $1
    `,
    [req.restaurantId]
  );

  res.json({ balance: result.rows[0].balance });
});

router.post("/transaction", authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { amount, type, source, description, denominations } = req.body;

    /* =========================
       BASIC VALIDATION
    ========================= */
    if (!amount || !type || !source) {
      throw new Error("Missing fields");
    }

    const VALID_SOURCES = [
      "cash_transfer",
      "bank_to_cash",
      "owner_deposit",
      "owner_withdraw"
    ];

    if (!VALID_SOURCES.includes(source)) {
      throw new Error("Invalid source");
    }

    if (!["credit", "debit"].includes(type)) {
      throw new Error("Invalid type");
    }

    /* =========================
       TYPE SAFETY (CRITICAL)
    ========================= */
    if (source === "cash_transfer" && type !== "credit") {
      throw new Error("Cash transfer must be credit");
    }

    if (source === "bank_to_cash" && type !== "debit") {
      throw new Error("Bank to cash must be debit");
    }

    if (source === "owner_deposit" && type !== "credit") {
      throw new Error("Deposit must be credit");
    }

    if (source === "owner_withdraw" && type !== "debit") {
      throw new Error("Withdraw must be debit");
    }

    await client.query("BEGIN");

    /* =========================
       GET BANK ACCOUNT
    ========================= */
    const bankRes = await client.query(
      `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
      [req.restaurantId]
    );

    const bankAccountId = bankRes.rows[0]?.id;

    if (!bankAccountId) {
      throw new Error("Bank account not configured");
    }

    const businessDayId = req.businessDayId;

    /* =========================
       CASH → BANK
    ========================= */
    if (source === "cash_transfer") {

      if (!denominations) {
        throw new Error("Denominations required");
      }

      let total = 0;

      for (const [value, qty] of Object.entries(denominations)) {
        total += Number(value) * Number(qty);
      }

      if (total !== Number(amount)) {
        throw new Error("Denomination mismatch");
      }

      // deduct from drawer
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
          throw new Error(`Not enough ₹${value}`);
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

      // record cash withdrawal
      await client.query(
        `
        INSERT INTO cash_withdrawals
        (restaurant_id, business_day_id, amount, reason)
        VALUES ($1,$2,$3,$4)
        `,
        [req.restaurantId, businessDayId, amount, "Bank Deposit"]
      );
    }

    /* =========================
       BANK → CASH
    ========================= */
    else if (source === "bank_to_cash") {

      if (!denominations) {
        throw new Error("Denominations required");
      }

      let total = 0;

      for (const [value, qty] of Object.entries(denominations)) {
        total += Number(value) * Number(qty);
      }

      if (total !== Number(amount)) {
        throw new Error("Denomination mismatch");
      }

      // add to drawer
      for (const [value, qty] of Object.entries(denominations)) {
        await client.query(
          `
          INSERT INTO denominations
          (restaurant_id, business_day_id, note_value, quantity)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (restaurant_id, business_day_id, note_value)
          DO UPDATE SET quantity = denominations.quantity + $4
          `,
          [req.restaurantId, businessDayId, value, qty]
        );
      }

      // record deposit
      await client.query(
        `
        INSERT INTO cash_deposits
        (restaurant_id, business_day_id, amount, reason)
        VALUES ($1,$2,$3,$4)
        `,
        [req.restaurantId, businessDayId, amount, "Bank to Cash"]
      );
    }

    /* =========================
       OWNER DEPOSIT / WITHDRAW
       (NO EXTRA LOGIC NEEDED)
    ========================= */

    /* =========================
       INSERT BANK TRANSACTION
    ========================= */
    await client.query(
      `
      INSERT INTO bank_transactions
      (restaurant_id, bank_account_id, amount, type, source, description)
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        req.restaurantId,
        bankAccountId,
        amount,
        type,
        source,
        description || null
      ]
    );

    await client.query("COMMIT");

    res.json({ message: "Success" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);

    res.status(400).json({
      message: err.message || "Transaction failed"
    });
  } finally {
    client.release();
  }
});

router.get("/history", authenticate, requireAdmin, async (req, res) => {
  const result = await pool.query(
    `
    SELECT *
    FROM bank_transactions
    WHERE restaurant_id = $1
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [req.restaurantId]
  );

  res.json(result.rows);
});

export default router;