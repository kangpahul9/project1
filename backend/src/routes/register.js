import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import pool from "../config/db.js";
import logger from "../utils/logger.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: "Too many registration attempts. Try again later." },
});

/* =========================================
   GET /api/register/check-uid?uid=xxx
   Public — check if a business UID is available
========================================= */
router.get("/check-uid", async (req, res, next) => {
  try {
    const { uid } = req.query;
    if (!uid || !/^[a-z0-9-]{3,30}$/.test(uid)) {
      return res.json({ available: false });
    }
    const result = await pool.query(
      `SELECT id FROM restaurants WHERE restaurant_uid = $1`,
      [uid]
    );
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   POST /api/register
   Public — create account + Stripe customer + SetupIntent
========================================= */
router.post("/", registerLimiter, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { businessUid, businessName, ownerName, email, password, phone, plan } = req.body;

    if (!businessUid?.trim() || !businessName?.trim() || !ownerName?.trim() || !email?.trim() || !password || !plan) {
      return res.status(400).json({ message: "All fields are required." });
    }
    if (!/^[a-z0-9-]{3,30}$/.test(businessUid)) {
      return res.status(400).json({ message: "Business ID must be 3–30 characters: lowercase letters, numbers, and hyphens only." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email address." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    if (!["weekly", "yearly"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan." });
    }

    await client.query("BEGIN");

    // Check UID not already taken
    const uidCheck = await client.query(
      `SELECT id FROM restaurants WHERE restaurant_uid = $1`,
      [businessUid]
    );
    if (uidCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "This Business ID is already taken. Please choose another." });
    }

    // Check email not already used
    const existing = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    // Use the user-chosen UID
    const restaurantUid = businessUid;
    const restaurantRes = await client.query(
      `INSERT INTO restaurants (restaurant_uid, name, phone, subscription_status, subscription_valid_till)
       VALUES ($1, $2, $3, 'trial', NOW() + INTERVAL '14 days')
       RETURNING id`,
      [restaurantUid, businessName.trim(), phone?.trim() || null]
    );
    const restaurantId = restaurantRes.rows[0].id;

    // Create restaurant_settings row
    await client.query(
      `INSERT INTO restaurant_settings (restaurant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [restaurantId]
    );

    // Create admin user
    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, restaurant_id, role)
       VALUES ($1, $2, $3, $4, 'ADMIN')
       RETURNING id`,
      [ownerName.trim(), email.toLowerCase().trim(), passwordHash, restaurantId]
    );
    const userId = userRes.rows[0].id;

    // Stripe — create customer + SetupIntent for card collection
    let clientSecret = null;
    let stripeCustomerId = null;

    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const customer = await stripe.customers.create({
        email: email.toLowerCase().trim(),
        name: ownerName.trim(),
        metadata: { restaurantId: String(restaurantId), plan },
      });
      stripeCustomerId = customer.id;

      await client.query(
        `UPDATE restaurants SET stripe_customer_id = $1 WHERE id = $2`,
        [stripeCustomerId, restaurantId]
      );

      // SetupIntent — collect card upfront, charge after trial ends
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        usage: "off_session",
        metadata: { restaurantId: String(restaurantId), plan },
      });
      clientSecret = setupIntent.client_secret;
    }

    await client.query("COMMIT");

    // Issue JWT
    const token = jwt.sign(
      { id: userId, restaurantId, role: "ADMIN" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    logger.info({ restaurantId, email, plan }, "New account registered");

    res.status(201).json({
      token,
      restaurantUid,
      clientSecret,
      trial: {
        endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        plan,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   POST /api/register/confirm-payment
   Called after Stripe.confirmCardSetup succeeds
   Saves the payment method and creates subscription
========================================= */
router.post("/confirm-payment", async (req, res, next) => {
  try {
    const { restaurantUid, paymentMethodId, plan } = req.body;

    if (!restaurantUid || !paymentMethodId || !plan) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({ ok: true }); // No Stripe configured — skip silently
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const restRes = await pool.query(
      `SELECT stripe_customer_id FROM restaurants WHERE restaurant_uid = $1`,
      [restaurantUid]
    );
    const customerId = restRes.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(404).json({ message: "Restaurant not found." });

    // Attach payment method as default
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Create subscription with 14-day trial
    const priceId = plan === "yearly"
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID_WEEKLY;

    if (priceId) {
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: 14,
        default_payment_method: paymentMethodId,
        metadata: { restaurantUid, plan },
      });

      await pool.query(
        `UPDATE restaurants
         SET stripe_subscription_id = $1, subscription_status = 'trial'
         WHERE restaurant_uid = $2`,
        [sub.id, restaurantUid]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
