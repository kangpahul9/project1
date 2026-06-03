import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */

async function getEftposSettings(restaurantId) {
  const res = await pool.query(
    `SELECT eftpos_provider, eftpos_api_key, eftpos_merchant_id, eftpos_terminal_id
     FROM restaurant_settings WHERE restaurant_id = $1`,
    [restaurantId]
  );
  return res.rows[0] || {};
}

/* ─────────────────────────────────────────
   TYRO: initiate purchase
   Docs: https://developer.tyro.com
───────────────────────────────────────── */
async function tyroInitiate({ apiKey, merchantId, terminalId, amountCents }) {
  const res = await fetch("https://api.tyro.com/connect/pay/v1/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      transactionType: "PURCHASE",
      amount: amountCents,
      merchantId,
      terminalId,
      integratedReceipt: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Tyro error ${res.status}`);
  }

  const data = await res.json();
  return { transactionId: data.transactionId || data.id };
}

async function tyroPoll({ apiKey, transactionId }) {
  const res = await fetch(
    `https://api.tyro.com/connect/pay/v1/transactions/${transactionId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!res.ok) throw new Error(`Tyro poll error ${res.status}`);
  const data = await res.json();

  // Tyro statuses: PENDING | APPROVED | DECLINED | CANCELLED | ERROR
  return {
    status: data.status?.toUpperCase() || "PENDING",
    raw: data,
  };
}

/* ─────────────────────────────────────────
   LINKLY (PC-EFTPOS): initiate purchase
   Docs: https://linkly.com.au/developers
───────────────────────────────────────── */
async function linklyInitiate({ apiKey, terminalId, amountCents }) {
  // Linkly Cloud requires a pairing secret exchanged during setup.
  // apiKey here holds the Bearer token obtained from pairing.
  const sessionId = `pos_${Date.now()}`;

  const res = await fetch(
    `https://rest.cloud.pceftpos.com/v1/sessions/${sessionId}/transaction`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        Request: {
          TxnType: "P",          // Purchase
          AmtPurchase: amountCents,
          TerminalId: terminalId,
          PurchaseAnalysisData: "",
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Linkly error ${res.status}`);
  }

  return { transactionId: sessionId };
}

async function linklyPoll({ apiKey, transactionId }) {
  const res = await fetch(
    `https://rest.cloud.pceftpos.com/v1/sessions/${transactionId}/transaction`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!res.ok) throw new Error(`Linkly poll error ${res.status}`);
  const data = await res.json();

  // Linkly Response: ResponseCode "00" = approved
  const responseCode = data.Response?.ResponseCode;
  let status = "PENDING";
  if (responseCode === "00") status = "APPROVED";
  else if (responseCode && responseCode !== "") status = "DECLINED";

  return { status, raw: data };
}

/* ─────────────────────────────────────────
   POST /eftpos/charge
   Body: { amountCents: number }
───────────────────────────────────────── */
router.post("/charge", authenticate, async (req, res, next) => {
  try {
    const { amountCents } = req.body;

    if (!amountCents || amountCents <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const cfg = await getEftposSettings(req.restaurantId);

    if (!cfg.eftpos_provider) {
      return res.status(503).json({
        error: "EFTPOS not configured. Set provider in Settings.",
      });
    }

    if (!cfg.eftpos_api_key) {
      return res.status(503).json({ error: "EFTPOS API key missing" });
    }

    let result;

    if (cfg.eftpos_provider === "tyro") {
      result = await tyroInitiate({
        apiKey: cfg.eftpos_api_key,
        merchantId: cfg.eftpos_merchant_id,
        terminalId: cfg.eftpos_terminal_id,
        amountCents,
      });
    } else if (cfg.eftpos_provider === "linkly") {
      result = await linklyInitiate({
        apiKey: cfg.eftpos_api_key,
        terminalId: cfg.eftpos_terminal_id,
        amountCents,
      });
    } else {
      return res.status(400).json({ error: "Unknown EFTPOS provider" });
    }

    res.json({ transactionId: result.transactionId, provider: cfg.eftpos_provider });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────
   GET /eftpos/status/:transactionId
───────────────────────────────────────── */
router.get("/status/:transactionId", authenticate, async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const cfg = await getEftposSettings(req.restaurantId);

    if (!cfg.eftpos_provider || !cfg.eftpos_api_key) {
      return res.status(503).json({ error: "EFTPOS not configured" });
    }

    let result;

    if (cfg.eftpos_provider === "tyro") {
      result = await tyroPoll({ apiKey: cfg.eftpos_api_key, transactionId });
    } else if (cfg.eftpos_provider === "linkly") {
      result = await linklyPoll({ apiKey: cfg.eftpos_api_key, transactionId });
    } else {
      return res.status(400).json({ error: "Unknown EFTPOS provider" });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────
   GET /eftpos/config  — check if configured
───────────────────────────────────────── */
router.get("/config", authenticate, async (req, res, next) => {
  try {
    const cfg = await getEftposSettings(req.restaurantId);
    res.json({
      configured: !!cfg.eftpos_provider && !!cfg.eftpos_api_key,
      provider: cfg.eftpos_provider || null,
      terminalId: cfg.eftpos_terminal_id || null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
