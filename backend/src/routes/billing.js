import express from "express";
import Stripe from "stripe";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔥 ENV BASE URL (VERY IMPORTANT)
const CLIENT_URL = process.env.CLIENT_URL; 
// e.g. https://kangpos.com

/* ========================================
   CREATE CHECKOUT SESSION
======================================== */
router.post("/create-checkout", authenticate, async (req, res) => {
  try {
    const email = req.user.email; // 🔥 NEVER trust frontend
    const restaurantId = req.restaurantId;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      customer_email: email,

      customer_creation: "always",

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],

      // ✅ DYNAMIC URL (PRODUCTION SAFE)
      success_url: `${CLIENT_URL}/settings?billing=success`,
      cancel_url: `${CLIENT_URL}/settings?billing=cancel`,

      // 🔥 CRITICAL: attach metadata
      metadata: {
        restaurantId: String(restaurantId),
      },
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Stripe error" });
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
      console.error("Webhook verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      /* ==============================
         SUBSCRIPTION STARTED
      ============================== */
      if (event.type === "checkout.session.completed") {
  const session = event.data.object;

  if (session.mode !== "subscription") {
    return res.json({ received: true });
  }

  const restaurantId = session.metadata?.restaurantId;
  const customerId = session.customer;
  const subscriptionId = session.subscription || null;

  if (!restaurantId) throw new Error("Missing metadata");

  const result = await pool.query(
    `
    UPDATE restaurants
    SET 
      subscription_status = 'active',
      stripe_customer_id = $1,
      stripe_subscription_id = $2
    WHERE id = $3
    `,
    [customerId, subscriptionId, restaurantId]
  );

  if (result.rowCount === 0) {
    console.error("❌ No restaurant found:", restaurantId);
  }

  console.log("✅ Subscription activated:", restaurantId);
}

      /* ==============================
         SUBSCRIPTION CANCELLED
      ============================== */
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;

        const customerId = subscription.customer;

        await pool.query(
          `
          UPDATE restaurants
          SET subscription_status = 'inactive'
          WHERE stripe_customer_id = $1
          `,
          [customerId]
        );

        console.log("❌ Subscription cancelled:", customerId);
      }

      /* ==============================
         PAYMENT FAILED (OPTIONAL)
      ============================== */
      if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;

        await pool.query(
          `
          UPDATE restaurants
          SET subscription_status = 'past_due'
          WHERE stripe_customer_id = $1
          `,
          [invoice.customer]
        );

        console.log("⚠️ Payment failed:", invoice.customer);
      }

      res.json({ received: true });

    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

export default router;