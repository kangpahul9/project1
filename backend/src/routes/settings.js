import express from "express";
import pool from "../config/db.js";
import QRCode from "qrcode";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { encrypt, decrypt } from "../utils/crypto.js";

const router = express.Router();

export async function updateCurrency(req, res) {
  try {
    const { currency_code } = req.body;

    const allowed = ["AUD", "INR"];
    if (!allowed.includes(currency_code)) {
      return res.status(400).json({ message: "Invalid currency" });
    }

    const result = await pool.query(
      `
      UPDATE restaurant_settings
      SET currency_code = $1
      WHERE restaurant_id = $2
      RETURNING *
      `,
      [currency_code, req.restaurantId]
    );

    res.json({ settings: result.rows[0] });

  } catch (err) {
    req.log.error({ err }, "Currency update failed");
    res.status(500).json({ message: "Currency update failed" });
  }
}


// =========================================
// UPDATE CURRENCY
// =========================================
router.put("/currency", authenticate, requireAdmin, updateCurrency);

// =========================================
// GET SYSTEM SETTINGS
// =========================================
router.get("/", authenticate, async (req, res) => {
  const isAdmin = req.user?.role === "ADMIN";
  // EFTPOS credentials are only returned to admins; all users get feature flags
  const selectCols = isAdmin
    ? "*"
    : `restaurant_id, use_business_day, enable_cash_recount, allow_staff_print,
       enable_vendor_ledger, enable_customer_ledger, enable_email, enable_partners,
       enable_manual_change, use_payroll, payroll_provider,
       currency_code, currency_symbol, currency_locale,
       payid, payid_name, eftpos_provider, created_at, updated_at`;

  try {
    let result = await pool.query(
      `SELECT ${selectCols} FROM restaurant_settings WHERE restaurant_id = $1 LIMIT 1`,
      [req.restaurantId]
    );

    if (!result.rows.length) {
      await pool.query(
        `INSERT INTO restaurant_settings (restaurant_id) VALUES ($1)`,
        [req.restaurantId]
      );
      result = await pool.query(
        `SELECT ${selectCols} FROM restaurant_settings WHERE restaurant_id = $1 LIMIT 1`,
        [req.restaurantId]
      );
    }

    const row = result.rows[0];
    if (row) {
      row.eftpos_api_key    = decrypt(row.eftpos_api_key);
      row.eftpos_merchant_id = decrypt(row.eftpos_merchant_id);
      row.eftpos_terminal_id = decrypt(row.eftpos_terminal_id);
    }
    res.json(row);

  } catch (err) {
    req.log.error({ err }, "GET /settings error");
    res.status(500).json({ message: "Server error" });
  }
});


// =========================================
// UPDATE SYSTEM SETTINGS
// =========================================
router.put("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      use_business_day,
      enable_cash_recount,
      allow_staff_print,
      enable_vendor_ledger,
      enable_customer_ledger,
      enable_whatsapp,
      enable_email,
      enable_partners,
      use_payroll,
      upi_id,
      payid,
      payid_name,
      eftpos_provider,
      eftpos_api_key,
      eftpos_merchant_id,
      eftpos_terminal_id,
    } = req.body;

    // 🔥 Get currency first
    const currencyRes = await pool.query(
      `SELECT currency_code FROM restaurant_settings WHERE restaurant_id=$1`,
      [req.restaurantId]
    );

    const currency = currencyRes.rows[0]?.currency_code;

    /* =========================
       VALIDATION
    ========================= */

    if (currency === "INR") {
      if (upi_id && !upi_id.includes("@")) {
        return res.status(400).json({ message: "Invalid UPI ID" });
      }
    }

    if (currency === "AUD") {
      if (payid && payid.length < 5) {
        return res.status(400).json({ message: "Invalid PayID" });
      }
    }

    /* =========================
       UPDATE
    ========================= */
    const result = await pool.query(
      `
      UPDATE restaurant_settings
      SET
        use_business_day = $1,
        enable_cash_recount = $2,
        allow_staff_print = $3,
        enable_vendor_ledger = $4,
        enable_customer_ledger = $5,
        enable_whatsapp = $6,
        enable_email = $7,
        enable_partners = $8,
        use_payroll = $9,

        upi_id = $10,
        payid = $11,
        payid_name = $12,

        eftpos_provider = $13,
        eftpos_api_key = $14,
        eftpos_merchant_id = $15,
        eftpos_terminal_id = $16,

        updated_at = NOW()
      WHERE restaurant_id = $17
      RETURNING *
      `,
      [
        use_business_day,
        enable_cash_recount,
        allow_staff_print,
        enable_vendor_ledger,
        enable_customer_ledger,
        enable_whatsapp,
        enable_email,
        enable_partners,
        use_payroll ?? false,

        upi_id?.trim() || null,
        payid?.trim() || null,
        payid_name?.trim() || null,

        eftpos_provider || null,
        encrypt(eftpos_api_key?.trim() || null),
        encrypt(eftpos_merchant_id?.trim() || null),
        encrypt(eftpos_terminal_id?.trim() || null),

        req.restaurantId
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    req.log.error({ err }, "PUT /settings error");
    res.status(500).json({ message: "Server error" });
  }
});


// =========================================
// GET COMMUNICATION SETTINGS
// =========================================
router.get("/communication", authenticate, async (req, res) => {
  try {
    let result = await pool.query(
      `
      SELECT *
      FROM communication_settings
      WHERE restaurant_id = $1
      LIMIT 1
      `,
      [req.restaurantId]
    );

    if (!result.rows.length) {
      const inserted = await pool.query(
        `
        INSERT INTO communication_settings (restaurant_id)
        VALUES ($1)
        RETURNING *
        `,
        [req.restaurantId]
      );

      result = inserted;
    }

    res.json(result.rows[0]);

  } catch (err) {
    req.log.error({ err }, "GET /communication error");
    res.status(500).json({ message: "Server error" });
  }
});

// =========================================
// UPDATE COMMUNICATION SETTINGS
// =========================================
router.put("/communication", authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      send_bill_whatsapp,
      send_bill_email,
      notify_owner_whatsapp,
      notify_owner_email,
      owner_phone,
      owner_email
    } = req.body;

    if (owner_email && !owner_email.includes("@")) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const result = await pool.query(
      `
      UPDATE communication_settings
      SET
        send_bill_whatsapp = $1,
        send_bill_email = $2,
        notify_owner_whatsapp = $3,
        notify_owner_email = $4,
        owner_phone = $5,
        owner_email = $6,
        updated_at = NOW()
      WHERE restaurant_id = $7
      RETURNING *
      `,
      [
        send_bill_whatsapp,
        send_bill_email,
        notify_owner_whatsapp,
        notify_owner_email,
        owner_phone?.trim() || null,
        owner_email?.trim() || null,
        req.restaurantId
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    req.log.error({ err }, "PUT /communication error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/bank-account", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        id,
        name as bank_name,
        account_number,
        ifsc,
        account_holder,
        created_at
      FROM bank_accounts
      WHERE restaurant_id=$1
      ORDER BY id ASC
      LIMIT 1
      `,
      [req.restaurantId]
    );

    res.json(result.rows[0] || null);

  } catch (err) {
    req.log.error({ err }, "GET /bank-account error");
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/bank-account", authenticate, requireAdmin, async (req, res) => {
  const {
    bank_name,
    account_number,
    ifsc,
    account_holder,
    opening_balance
  } = req.body;

  const client = await pool.connect();

  try {
    /* =========================
       VALIDATION
    ========================= */
    if (!bank_name || !bank_name.trim()) {
      throw new Error("Bank name required");
    }

    if (!account_number || account_number.length < 6) {
      throw new Error("Invalid account number");
    }

    if (!account_holder || !account_holder.trim()) {
      throw new Error("Account holder required");
    }

    const opening = Number(opening_balance || 0);

    if (isNaN(opening) || opening < 0) {
      throw new Error("Invalid opening balance");
    }

    await client.query("BEGIN");

    /* =========================
       PREVENT DUPLICATE
    ========================= */
    const existing = await client.query(
      `SELECT id FROM bank_accounts WHERE restaurant_id=$1 FOR UPDATE`,
      [req.restaurantId]
    );

    if (existing.rows.length > 0) {
      throw new Error("Bank account already exists");
    }

    /* =========================
       INSERT BANK ACCOUNT
    ========================= */
    const result = await client.query(
      `
      INSERT INTO bank_accounts
      (restaurant_id, name, account_number, ifsc, account_holder)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [
        req.restaurantId,
        bank_name.trim(),
        account_number.trim(),
        ifsc?.trim() || null,
        account_holder.trim()
      ]
    );

    const bankAccount = result.rows[0];

    /* =========================
       OPENING BALANCE ENTRY
    ========================= */
    if (opening > 0) {
      await client.query(
        `
        INSERT INTO bank_transactions
        (restaurant_id, bank_account_id, amount, type, source, description)
        VALUES ($1,$2,$3,'credit','opening_balance','Initial Balance')
        `,
        [
          req.restaurantId,
          bankAccount.id,
          opening
        ]
      );

      /* 🔥 OPTIONAL (future step 6 compatible) */
      await client.query(
        `
        INSERT INTO ledger_events
        (restaurant_id, entity_type, entity_id, event_type, amount, metadata)
        VALUES ($1,'bank',$2,'bank_credit',$3,$4)
        `,
        [
          req.restaurantId,
          bankAccount.id,
          opening,
          JSON.stringify({ source: "opening_balance" })
        ]
      );
    }

    await client.query("COMMIT");

    res.json(bankAccount);

  } catch (err) {
    await client.query("ROLLBACK");

    req.log.error({ err }, "POST /bank-account error");

    res.status(400).json({
      message: err.message || "Failed to create bank account"
    });

  } finally {
    client.release();
  }
});

router.get("/payment-qr", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT currency_code, upi_id, payid, payid_name
      FROM restaurant_settings
      WHERE restaurant_id = $1
      LIMIT 1
      `,
      [req.restaurantId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Settings not found" });
    }

    const settings = result.rows[0];

    let qrData = "";

    /* INR */
    if (settings.currency_code === "INR") {
      if (!settings.upi_id) {
        return res.status(400).json({ message: "UPI not set" });
      }

      qrData = `upi://pay?pa=${settings.upi_id}&pn=KangPOS`;
    }

    /* AUD */
    else {
      if (!settings.payid) {
        return res.status(400).json({ message: "PayID not set" });
      }

      qrData = JSON.stringify({
        payid: settings.payid,
        name: settings.payid_name || "Business"
      });
    }

    const qr = await QRCode.toDataURL(qrData);

    res.json({
      qr,
      type: settings.currency_code === "INR" ? "UPI" : "PAYID",
      value: settings.currency_code === "INR"
        ? settings.upi_id
        : settings.payid
    });

  } catch (err) {
    req.log.error({ err }, "QR error");
    res.status(500).json({ message: "QR generation failed" });
  }
});

export default router;