import express from "express";
import Stripe from "stripe";
import pool from "../config/db.js";
import logger from "../utils/logger.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================
   ENV VALIDATION
========================= */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY not set");
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET not set");
}
if (!process.env.STRIPE_PRICE_ID) {
  throw new Error("STRIPE_PRICE_ID not set");
}
if (!process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL not set");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const CLIENT_URL = process.env.CLIENT_URL;

/* ========================================
   CREATE CHECKOUT SESSION
======================================== */
router.post("/create-checkout", authenticate, async (req, res, next) => {
  try {
    const restaurantId = req.restaurantId;

    const userRes = await pool.query(
      `SELECT email FROM users WHERE id=$1`,
      [req.userId]
    );

    const email = userRes.rows[0]?.email;

    if (!email) {
      throw new Error("User email not found");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],

      success_url: `${CLIENT_URL}/settings?billing=success`,
      cancel_url: `${CLIENT_URL}/settings?billing=cancel`,

      metadata: {
        restaurantId: String(restaurantId),
      },
    });

    res.json({ url: session.url });

  } catch (err) {
    req.log?.error(err, "Stripe checkout error");
    next(err);
  }
});

/* ========================================
   STRIPE WEBHOOK
======================================== */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.error({ err }, "Webhook verification failed");
      return res.status(400).send(`Webhook Error`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          if (session.mode !== "subscription") break;

          const restaurantId = session.metadata?.restaurantId;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (!restaurantId) break;

          let validTill = null;

          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            validTill = new Date(subscription.current_period_end * 1000);
          }

          await pool.query(
            `
            UPDATE restaurants
            SET 
              subscription_status = 'active',
              stripe_customer_id = $1,
              stripe_subscription_id = $2,
              subscription_valid_till = $3
            WHERE id = $4
            `,
            [customerId, subscriptionId, validTill, restaurantId]
          );

          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription;

          if (!subscriptionId) break;

          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          const validTill = new Date(subscription.current_period_end * 1000);

          await pool.query(
            `
            UPDATE restaurants
            SET 
              subscription_status = 'active',
              subscription_valid_till = $1
            WHERE stripe_subscription_id = $2
            `,
            [validTill, subscriptionId]
          );

          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;

          await pool.query(
            `
            UPDATE restaurants
            SET subscription_status = 'past_due'
            WHERE stripe_customer_id = $1
            `,
            [invoice.customer]
          );

          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;

          await pool.query(
            `
            UPDATE restaurants
            SET subscription_status = 'inactive'
            WHERE stripe_subscription_id = $1
            `,
            [subscription.id]
          );

          break;
        }

        default:
          break;
      }

      res.json({ received: true });

    } catch (err) {
      logger.error({ err }, "Webhook handler error");
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

/* ========================================
   GET SUBSCRIPTION
======================================== */
router.get("/subscription", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT subscription_status, subscription_valid_till
      FROM restaurants
      WHERE id = $1
      `,
      [req.restaurantId]
    );

    res.json(result.rows[0] || null);

  } catch (err) {
    next(err);
  }
});

export default router;