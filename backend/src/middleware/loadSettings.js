import pool from "../config/db.js";
import logger from "../utils/logger.js";

export async function loadSettings(req, res, next) {
  try {
    let result = await pool.query(
      `
      SELECT *
      FROM restaurant_settings
      WHERE restaurant_id = $1
      `,
      [req.restaurantId]
    );

    if (result.rows.length === 0) {
      try {
        const inserted = await pool.query(
          `
          INSERT INTO restaurant_settings (restaurant_id)
          VALUES ($1)
          RETURNING *
          `,
          [req.restaurantId]
        );

        req.settings = inserted.rows[0];
      } catch (err) {
        // race condition fallback
        const fallback = await pool.query(
          `
          SELECT *
          FROM restaurant_settings
          WHERE restaurant_id = $1
          `,
          [req.restaurantId]
        );

        req.settings = fallback.rows[0];
      }
    } else {
      req.settings = result.rows[0];
    }

    const currencyMap = {
      AUD: { symbol: "$", locale: "en-AU" },
      INR: { symbol: "₹", locale: "en-IN" },
    };

    const currency =
      currencyMap[req.settings.currency_code] || currencyMap["AUD"];

    req.settings = {
      ...req.settings,
      currency: {
        code: req.settings.currency_code,
        symbol: currency.symbol,
        locale: currency.locale,
      },
    };

    next();
  } catch (err) {
    logger.error({ err }, "Settings load error");

    res.status(500).json({
      message: "Settings load failed",
    });
  }
}