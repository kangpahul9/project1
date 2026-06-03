import pool from "../config/db.js";
import logger from "../utils/logger.js";

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

    if (result.rows.length === 0) {
      return res.status(403).json({
        message: "Subscription not found",
      });
    }

    const sub = result.rows[0];
    const now = new Date();

    if (sub.subscription_status !== "active") {
      return res.status(403).json({
        message: "Subscription inactive",
      });
    }

    if (
      sub.subscription_valid_till &&
      new Date(sub.subscription_valid_till) < now
    ) {
      return res.status(403).json({
        message: "Subscription expired",
      });
    }

    next();
  } catch (err) {
    logger.error({ err }, "Subscription check error");

    res.status(500).json({
      message: "Subscription check failed",
    });
  }
};