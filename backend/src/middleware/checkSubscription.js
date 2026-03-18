import pool from "../config/db.js";

export const checkSubscription = async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT subscription_status, subscription_valid_till
      FROM restaurants
      WHERE id = $1
      `,
      [req.restaurantId]
    );

    const sub = result.rows[0];

    // If no subscription record → block
    if (!sub) {
      return res.status(403).json({
        message: "Please recharge to continue",
      });
    }

    const now = new Date();

    // ❌ expired
    if (
      sub.subscription_status !== "active" ||
      (sub.subscription_valid_till &&
        new Date(sub.subscription_valid_till) < now)
    ) {
      return res.status(403).json({
        message: "Subscription expired. Please recharge.",
      });
    }

    // ✅ allowed
    next();
  } catch (err) {
    console.error("Subscription check error:", err);
    res.status(500).json({ message: "Subscription check failed" });
  }
};