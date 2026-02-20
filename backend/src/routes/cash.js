import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import db from "../config/db.js";

const router = express.Router();

// GET CURRENT DRAWER CASH
router.get("/current", async (req, res) => {
  try {
    const { businessDayId } = req.query;

    if (!businessDayId) {
      return res.status(400).json({ message: "Business Day required" });
    }

    const result = await db.query(`
      SELECT note_value, SUM(quantity) as quantity
      FROM denominations
      WHERE business_day_id = $1
      GROUP BY note_value
      ORDER BY note_value DESC
    `, [businessDayId]);

    const breakdown = result.rows;

    const total = breakdown.reduce(
      (acc, row) => acc + Number(row.note_value) * Number(row.quantity),
      0
    );

    res.json({
      total,
      breakdown,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;