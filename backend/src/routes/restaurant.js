import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================
   GET RESTAURANT INFO
========================================= */
router.get("/info", authenticate, async (req, res, next) => {
  try {
    const { restaurantId } = req;

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        address,
        logo_url,
        currency,
        receipt_footer,
        subscription_status,
        subscription_valid_till,
        created_at,
        updated_at
      FROM restaurants
      WHERE id = $1
      `,
      [restaurantId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    next(err);
  }
});

/* =========================================
   UPDATE RESTAURANT INFO
========================================= */
router.put("/info", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { restaurantId } = req;

    const {
      name,
      phone,
      email,
      address,
      logoUrl,
      currency,
      receiptFooter
    } = req.body;

    /* =========================
       VALIDATION
    ========================= */
    if (!name || !name.trim()) {
      throw new Error("Restaurant name required");
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error("Invalid email");
    }

    if (phone && phone.length < 6) {
      throw new Error("Invalid phone number");
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE restaurants
      SET
        name = $1,
        phone = $2,
        email = $3,
        address = $4,
        logo_url = $5,
        currency = $6,
        receipt_footer = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
      [
        name.trim(),
        phone || null,
        email || null,
        address || null,
        logoUrl || null,
        currency || "₹",
        receiptFooter || "Thank you 🙏 Visit Again",
        restaurantId
      ]
    );

    if (!result.rows.length) {
      throw new Error("Restaurant not found");
    }

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
   GET SETTINGS
========================================= */
router.get("/settings", authenticate, async (req, res, next) => {
  try {
    const { restaurantId } = req;

    const result = await pool.query(
      `
      SELECT *
      FROM restaurant_settings
      WHERE restaurant_id = $1
      `,
      [restaurantId]
    );

    if (!result.rows.length) {
      return res.json({});
    }

    res.json(result.rows[0]);

  } catch (err) {
    next(err);
  }
});

/* =========================================
   UPDATE SETTINGS
========================================= */
router.put("/settings", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;

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
      INSERT INTO restaurant_settings (
        restaurant_id,
        use_business_day,
        enable_cash_recount,
        allow_staff_print,
        enable_vendor_ledger,
        enable_customer_ledger,
        enable_whatsapp,
        enable_email,
        enable_partners,
        upi_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (restaurant_id)
      DO UPDATE SET
        use_business_day = EXCLUDED.use_business_day,
        enable_cash_recount = EXCLUDED.enable_cash_recount,
        allow_staff_print = EXCLUDED.allow_staff_print,
        enable_vendor_ledger = EXCLUDED.enable_vendor_ledger,
        enable_customer_ledger = EXCLUDED.enable_customer_ledger,
        enable_whatsapp = EXCLUDED.enable_whatsapp,
        enable_email = EXCLUDED.enable_email,
        enable_partners = EXCLUDED.enable_partners,
        upi_id = EXCLUDED.upi_id,
        updated_at = NOW()
      RETURNING *
      `,
      [
        restaurantId,
        use_business_day ?? true,
        enable_cash_recount ?? true,
        allow_staff_print ?? true,
        enable_vendor_ledger ?? true,
        enable_customer_ledger ?? true,
        enable_whatsapp ?? false,
        enable_email ?? false,
        enable_partners ?? false,
        upi_id || null
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    next(err);
  }
});

/* =========================================
   UPLOAD LOGO (OPTIONAL FUTURE)
========================================= */
// You can later integrate multer or S3 here

export default router;