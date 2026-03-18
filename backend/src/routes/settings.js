import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();


// =========================================
// GET SYSTEM SETTINGS
// =========================================
router.get("/", authenticate, async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT *
      FROM restaurant_settings
      WHERE restaurant_id = $1
      `,
      [req.restaurantId]
    );

    if (result.rows.length === 0) {
      const inserted = await pool.query(
        `
        INSERT INTO restaurant_settings (restaurant_id)
        VALUES ($1)
        RETURNING *
        `,
        [req.restaurantId]
      );

      return res.json(inserted.rows[0]);
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =========================================
// UPDATE SYSTEM SETTINGS
// =========================================
router.put("/", authenticate, async (req, res) => {
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
      upi_id
    } = req.body;

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
        upi_id = $9,
        updated_at = NOW()
      WHERE restaurant_id = $10
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
        upi_id,
        req.restaurantId
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =========================================
// GET COMMUNICATION SETTINGS
// =========================================
router.get("/communication", authenticate, async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT *
      FROM communication_settings
      WHERE restaurant_id = $1
      `,
      [req.restaurantId]
    );

    if (result.rows.length === 0) {
      const inserted = await pool.query(
        `
        INSERT INTO communication_settings (restaurant_id)
        VALUES ($1)
        RETURNING *
        `,
        [req.restaurantId]
      );

      return res.json(inserted.rows[0]);
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// =========================================
// UPDATE COMMUNICATION SETTINGS
// =========================================
router.put("/communication", authenticate, async (req, res) => {
  try {

    const {
      send_bill_whatsapp,
      send_bill_email,
      notify_owner_whatsapp,
      notify_owner_email,
      owner_phone,
      owner_email
    } = req.body;

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
        owner_phone,
        owner_email,
        req.restaurantId
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/bank-account", authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
    [req.restaurantId]
  );

  res.json(result.rows[0] || null);
});

router.post("/bank-account", authenticate, async (req, res) => {
  const { bank_name, account_number, ifsc, account_holder, opening_balance } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM bank_accounts WHERE restaurant_id=$1`,
      [req.restaurantId]
    );

    if (existing.rows.length > 0) {
      throw new Error("Bank account already exists");
    }

    const result = await client.query(
      `
      INSERT INTO bank_accounts
      (restaurant_id, name, account_number, ifsc, account_holder)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [req.restaurantId, bank_name, account_number, ifsc, account_holder]
    );

    const bankAccount = result.rows[0];

    // 🔥 Opening balance entry
    if (opening_balance && Number(opening_balance) > 0) {
      await client.query(
        `
        INSERT INTO bank_transactions
        (restaurant_id, bank_account_id, amount, type, source, description)
        VALUES ($1,$2,$3,'credit','opening_balance','Initial Balance')
        `,
        [
          req.restaurantId,
          bankAccount.id,
          opening_balance
        ]
      );
    }

    await client.query("COMMIT");

    res.json(bankAccount);

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

export default router;