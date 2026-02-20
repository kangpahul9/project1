import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ===============================
   GET CURRENT OPEN BUSINESS DAY
================================ */
router.get("/current", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM business_days WHERE is_closed = false ORDER BY id DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      return res.status(204).send(); // No active day
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


/* ===============================
   OPEN BUSINESS DAY
================================ */
router.post("/start", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { denominations } = req.body;

    if (!denominations || !Array.isArray(denominations)) {
      return res.status(400).json({ message: "Invalid denominations format" });
    }

    await client.query("BEGIN");

    // 1️⃣ Check no open day exists
    const existing = await client.query(
      "SELECT id FROM business_days WHERE is_closed = false LIMIT 1"
    );

    if (existing.rows.length > 0) {
      throw new Error("Business day already open");
    }

    // 2️⃣ Create new business day
    const dayResult = await client.query(
      `
      INSERT INTO business_days (date, is_closed)
      VALUES (CURRENT_DATE, false)
      RETURNING *
      `
    );

    const businessDay = dayResult.rows[0];

    // 3️⃣ Insert denominations
    for (const d of denominations) {
      const note = Number(d.note);
      const qty = Number(d.qty);

      if (!note || qty <= 0) continue;

      await client.query(
        `
        INSERT INTO denominations (business_day_id, note_value, quantity)
        VALUES ($1, $2, $3)
        `,
        [businessDay.id, note, qty]
      );
    }

    await client.query("COMMIT");

    res.status(201).json(businessDay);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});





/* ===============================
   CLOSE BUSINESS DAY
================================ */
/* ===============================
   CLOSE BUSINESS DAY
================================ */
router.post("/close", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { breakdown, total } = req.body;

    if (!breakdown || typeof total !== "number") {
      return res.status(400).json({
        message: "Invalid closing data",
      });
    }

    await client.query("BEGIN");

    // 1️⃣ Get current open business day
    const dayResult = await client.query(
      "SELECT * FROM business_days WHERE is_closed = false ORDER BY id DESC LIMIT 1"
    );

    if (dayResult.rows.length === 0) {
      throw new Error("No open business day");
    }

    const businessDay = dayResult.rows[0];

    // 2️⃣ Get current drawer from denominations
    const denomResult = await client.query(`
      SELECT SUM(note_value * quantity) AS total
      FROM denominations
      WHERE business_day_id = $1
    `, [businessDay.id]);

    const systemCash = Number(denomResult.rows[0].total || 0);

    // 3️⃣ Validate against drawer
    if (Math.abs(systemCash - total) > 0.01) {
      throw new Error(
        `Cash mismatch. Drawer: ₹${systemCash}, Counted: ₹${total}`
      );
    }

    // 4️⃣ Close day
    await client.query(
      `
      UPDATE business_days
      SET is_closed = true,
          closing_cash = $1
      WHERE id = $2
      `,
      [total, businessDay.id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Business day closed successfully",
      total,
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
