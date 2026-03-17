import express from "express";
import { authenticate,requireAdmin } from "../middleware/authMiddleware.js";
import db from "../config/db.js";

const router = express.Router();

// GET CURRENT DRAWER CASH
router.get("/current", authenticate, requireAdmin, async (req, res) => {
  try {

    const restaurantId = req.restaurantId;
    const businessDayId = req.businessDayId;

    const result = await db.query(`
      SELECT note_value, SUM(quantity) as quantity
      FROM denominations
      WHERE restaurant_id = $1
      AND business_day_id = $2
      GROUP BY note_value
      ORDER BY note_value DESC
    `, [restaurantId, businessDayId]);

    const breakdown = result.rows;

    const total = breakdown.reduce(
      (acc, row) => acc + Number(row.note_value) * Number(row.quantity),
      0
    );

    res.json({ total, breakdown });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// RECOUNT DRAWER CASH
router.post("/recount", authenticate, requireAdmin, async (req, res) => {
  const client = await db.connect();

  try {
    const { breakdown } = req.body;
    const restaurantId = req.restaurantId;
    const businessDayId = req.businessDayId;


    await client.query("BEGIN");

    // remove current drawer state
    await client.query(
      `DELETE FROM denominations
       WHERE restaurant_id = $1 AND business_day_id = $2`,
      [restaurantId, businessDayId]
    );

    // insert new counted denominations
    for (const note of breakdown) {
      if (note.qty > 0) {
        await client.query(
          `INSERT INTO denominations
          (restaurant_id, note_value, quantity,business_day_id)
          VALUES ($1,$2,$3,$4)`,
          [restaurantId, note.note, note.qty,businessDayId]
        );
      }
    }

    const total = breakdown.reduce(
      (sum, n) => sum + n.note * n.qty,
      0
    );

    // log recount history
    await client.query(
      `INSERT INTO cash_recounts
       (restaurant_id,total)
       VALUES ($1,$2)`,
      [restaurantId, total]
    );

    await client.query("COMMIT");

    res.json({ success: true, total });

  } catch (err) {

    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });

  } finally {
    client.release();
  }
});

export default router;