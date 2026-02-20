import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

const VALID_DENOMS = [500,200,100,50,20,10,5,2,1];

/* =========================================
   OWNER CASH WITHDRAWAL
========================================= */
router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { businessDayId, breakdown } = req.body;

    if (!businessDayId || !breakdown || breakdown.length === 0) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await client.query("BEGIN");

    let totalAmount = 0;

    for (const item of breakdown) {
      const note = Number(item.note);
      const qty = Number(item.qty);

      if (qty <= 0) continue;

      // Get current quantity
      const denomRes = await client.query(
        `
        SELECT id, quantity
        FROM denominations
        WHERE business_day_id = $1
        AND note_value = $2
        `,
        [businessDayId, note]
      );

      if (denomRes.rows.length === 0) {
        throw new Error(`No ${note} notes in drawer`);
      }

      const available = Number(denomRes.rows[0].quantity);

      if (qty > available) {
        throw new Error(`Not enough ₹${note} notes`);
      }

      // Deduct
      await client.query(
        `
        UPDATE denominations
        SET quantity = quantity - $1
        WHERE business_day_id = $2
        AND note_value = $3
        `,
        [qty, businessDayId, note]
      );

      totalAmount += note * qty;
    }

    if (totalAmount <= 0) {
      throw new Error("Withdrawal amount must be greater than 0");
    }

    // Save withdrawal record
    await client.query(
      `
      INSERT INTO cash_withdrawals (business_day_id, amount)
      VALUES ($1, $2)
      `,
      [businessDayId, totalAmount]
    );

    await client.query("COMMIT");

    res.json({
      message: "Withdrawal successful",
      totalAmount,
      breakdown
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});


export default router;
