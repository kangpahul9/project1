import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================
   GET RESTAURANT INFO
========================================= */
router.get("/info", authenticate, async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT
        name,
        phone,
        email,
        address,
        currency,
        receipt_footer,
        logo_url
      FROM restaurants
      WHERE id = $1
      `,
      [req.restaurantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================
   UPDATE RESTAURANT INFO
========================================= */
router.put("/info", authenticate, async (req, res) => {
  try {

    const {
      name,
      phone,
      email,
      address,
      currency,
      receipt_footer
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Restaurant name required" });
    }

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
  enable_partners
)
VALUES ($9,$1,$2,$3,$4,$5,$6,$7,$8)
ON CONFLICT (restaurant_id)
DO UPDATE SET
  use_business_day=$1,
  enable_cash_recount=$2,
  allow_staff_print=$3,
  enable_vendor_ledger=$4,
  enable_customer_ledger=$5,
  enable_whatsapp=$6,
  enable_email=$7,
  enable_partners=$8,
  updated_at=NOW()
RETURNING *
      `,
      [
        name,
        phone,
        email,
        address,
        currency,
        receipt_footer,
        req.restaurantId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;