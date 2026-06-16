import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { bankWithEvent } from "../utils/bankLedger.js";
import { deductCash, addCash } from "../utils/cashUtils.js";
import {
  validateDenominations,
  normalizeDenominations
} from "../utils/denominationUtils.js";

const router = express.Router();

/* =========================================
   GET BALANCE
========================================= */
router.get("/balance", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT balance FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
      [req.restaurantId]
    );

    res.json({
      balance: Number(result.rows[0]?.balance || 0),
    });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   TRANSACTION
========================================= */
router.post(
  "/transaction",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    const client = await pool.connect();

    try {
      let {
        amount,
        type,
        source,
        description,
        denominations,
        partnerId,
        idempotencyKey,
      } = req.body;

      amount = Number(amount);
      idempotencyKey = idempotencyKey?.trim();

      /* =========================
         BASIC VALIDATION
      ========================= */
      if (!amount || amount <= 0) {
        throw new Error("Invalid amount");
      }

      if (!["credit", "debit"].includes(type)) {
        throw new Error("Invalid transaction type");
      }

      if (!idempotencyKey) {
        throw new Error("Idempotency key required");
      }

      const VALID_SOURCES = [
        "cash_transfer",
        "bank_to_cash",
        "owner_deposit",
        "owner_withdraw",
      ];

      if (!VALID_SOURCES.includes(source)) {
        throw new Error("Invalid source");
      }

      /* =========================
         ACCOUNTING RULES
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

      const businessDayId = req.businessDayId;

      if (
        !businessDayId &&
        ["cash_transfer", "bank_to_cash"].includes(source)
      ) {
        throw new Error("Business day required for cash operations");
      }

      /* =========================
         DENOMINATION VALIDATION
      ========================= */
      if (
        ["cash_transfer", "bank_to_cash"].includes(source)
      ) {
        if (
          !denominations ||
          typeof denominations !== "object" ||
          Array.isArray(denominations)
        ) {
          throw new Error("Invalid denominations format");
        }

        for (const [k, v] of Object.entries(denominations)) {
          if (isNaN(Number(k)) || isNaN(Number(v))) {
            throw new Error("Invalid denomination values");
          }
        }
      }

      /* =========================
         START TRANSACTION
      ========================= */
      await client.query("BEGIN");

      /* =========================
         PARTNER VALIDATION (safe)
      ========================= */
      if (partnerId !== undefined && partnerId !== null) {
        const pid = Number(partnerId);
        if (!pid) throw new Error("Invalid partner");

        const check = await client.query(
          `SELECT id FROM partners WHERE id=$1 AND restaurant_id=$2`,
          [pid, req.restaurantId]
        );

        if (!check.rows.length) {
          throw new Error("Invalid partner");
        }

        partnerId = pid;
      }

      /* =========================
         GET BANK ACCOUNT
      ========================= */
      let bankRes = await client.query(
        `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
        [req.restaurantId]
      );
      if (!bankRes.rows.length) {
        bankRes = await client.query(
          `INSERT INTO bank_accounts (restaurant_id, name) VALUES ($1, 'Default Account') RETURNING id`,
          [req.restaurantId]
        );
      }
      const bankAccountId = bankRes.rows[0].id;

      /* =========================
         CASH → BANK
      ========================= */
      if (source === "cash_transfer") {
        denominations = normalizeDenominations(
          denominations,
          req.settings.currency.code
        );

        validateDenominations(
          denominations,
          amount,
          req.settings.currency.code
        );

        await deductCash(
          client,
          req.restaurantId,
          businessDayId,
          denominations
        );

        await client.query(
          `
          INSERT INTO cash_withdrawals
          (restaurant_id, business_day_id, amount, partner_id, reason)
          VALUES ($1,$2,$3,$4,'Bank Deposit')
          `,
          [
            req.restaurantId,
            businessDayId,
            amount,
            partnerId ?? null,
          ]
        );
      }

      /* =========================
         BANK → CASH
      ========================= */
      if (source === "bank_to_cash") {
        denominations = normalizeDenominations(
          denominations,
          req.settings.currency.code
        );

        validateDenominations(
          denominations,
          amount,
          req.settings.currency.code
        );

        await addCash(
          client,
          req.restaurantId,
          businessDayId,
          denominations
        );

        await client.query(
          `
          INSERT INTO cash_deposits
          (restaurant_id, business_day_id, amount, partner_id, reason)
          VALUES ($1,$2,$3,$4,'Bank to Cash')
          `,
          [
            req.restaurantId,
            businessDayId,
            amount,
            partnerId ?? null,
          ]
        );
      }

      /* =========================
         BANK LEDGER (IDEMPOTENT)
      ========================= */
      try {
        await bankWithEvent(client, {
  restaurantId: req.restaurantId,
  bankAccountId,
  amount,
  type,
  source,
  referenceId: null,
  description,
  partnerId,
  createdBy: req.userId,
  idempotencyKey
});
      } catch (err) {
        if (err.code === "23505") {
          await client.query("ROLLBACK");

          req.log?.info(
            { idempotencyKey },
            "Duplicate transaction prevented"
          );

          return res.status(200).json({
            message: "Already processed",
          });
        }
        throw err;
      }

      await client.query("COMMIT");

      req.log?.info(
        {
          amount,
          type,
          source,
          partnerId,
          restaurantId: req.restaurantId,
        },
        "Bank transaction success"
      );

      res.json({ message: "Success" });

    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      req.log?.error(err, "Bank transaction failed");

      const isDbError = err.code && /^[0-9A-Z]{5}$/.test(err.code);
      res.status(isDbError ? 500 : 400).json({
        message: isDbError ? "Server error" : (err.message || "Transaction failed"),
      });

    } finally {
      client.release();
    }
  }
);

/* =========================================
   HISTORY
========================================= */
router.get("/history", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM bank_transactions
      WHERE restaurant_id=$1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [req.restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;