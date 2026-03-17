import pool from "../config/db.js";

export async function loadSettings(req, res, next) {
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

      req.settings = inserted.rows[0];
    } else {
      req.settings = result.rows[0];
    }

    next();

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Settings load failed" });
  }
}