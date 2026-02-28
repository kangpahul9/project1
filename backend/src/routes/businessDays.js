import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { sendDiscrepancyEmail } from "../utils/email.js";

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
   GET EXPECTED CASH (LEDGER)
================================ */
router.get("/expected-cash", authenticate, async (req, res) => {
  try {
    const dayResult = await pool.query(
      "SELECT id FROM business_days WHERE is_closed = false ORDER BY id DESC LIMIT 1"
    );

    if (dayResult.rows.length === 0) {
      return res.status(404).json({ message: "No open business day" });
    }

    const businessDayId = dayResult.rows[0].id;

    const ledgerResult = await pool.query(
      `
      SELECT COALESCE(SUM(amount),0) AS total
      FROM cash_ledger
      WHERE business_day_id = $1
      `,
      [businessDayId]
    );

    res.json({
      businessDayId,
      expectedCash: Number(ledgerResult.rows[0].total)
    });

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

    // 2️⃣ Calculate opening cash from denominations
    let openingCash = 0;

    for (const d of denominations) {
      const note = Number(d.note);
      const qty = Number(d.qty);

      if (!note || qty <= 0) continue;

      openingCash += note * qty;
    }

    // 3️⃣ Create new business day with opening cash
    const dayResult = await client.query(
      `
      INSERT INTO business_days (date, is_closed, opening_cash)
      VALUES (CURRENT_DATE, false, $1)
      RETURNING *
      `,
      [openingCash]
    );

    const businessDay = dayResult.rows[0];

    // 4️⃣ Insert denominations
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

    // 5️⃣ Insert opening entry into ledger
    await client.query(
      `
      INSERT INTO cash_ledger (business_day_id, type, amount)
      VALUES ($1, 'opening', $2)
      `,
      [businessDay.id, openingCash]
    );

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

  let emailPayload = null; // ← store email data here

  try {
    const { breakdown, total, reason } = req.body;

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

    /* ===============================
       CHECK DRAWER (DENOMINATIONS)
    =============================== */

    const denomResult = await client.query(
      `
      SELECT SUM(note_value * quantity) AS total
      FROM denominations
      WHERE business_day_id = $1
      `,
      [businessDay.id]
    );

    const systemCash = Number(denomResult.rows[0].total || 0);

    if (Math.abs(systemCash - total) > 0.01) {
      throw new Error(
        `Drawer mismatch. Drawer: ₹${systemCash}, Counted: ₹${total}`
      );
    }

    /* ===============================
       CHECK LEDGER EXPECTED CASH
    =============================== */

    const ledgerResult = await client.query(
      `
      SELECT COALESCE(SUM(amount),0) AS total
      FROM cash_ledger
      WHERE business_day_id = $1
      `,
      [businessDay.id]
    );

    const expectedCash = Number(ledgerResult.rows[0].total);
    const difference = total - expectedCash;

    let hasDiscrepancy = false;
    let closingReason = reason || null;

    /* ===============================
       HANDLE DISCREPANCY
    =============================== */

    if (Math.abs(difference) > 0.01) {

      if (!closingReason || closingReason.trim() === "") {
        throw new Error("Ledger mismatch detected. Closing reason required.");
      }

      hasDiscrepancy = true;

      // Insert adjustment in ledger
      await client.query(
        `
        INSERT INTO cash_ledger
        (business_day_id, type, amount)
        VALUES ($1, 'closing_adjustment', $2)
        `,
        [businessDay.id, difference]
      );

      // Get closing user name for email
      const userRes = await client.query(
        "SELECT name FROM users WHERE id = $1",
        [req.user.id]
      );

      emailPayload = {
        userName: userRes.rows[0]?.name || "Unknown User",
        difference,
        countedCash: total,
        expectedCash,
        reason: closingReason,
      };
    }

    /* ===============================
       CLOSE BUSINESS DAY
    =============================== */

    await client.query(
      `
      UPDATE business_days
      SET is_closed = true,
          closing_cash = $1,
          closed_by = $2,
          closing_difference = $3,
          closing_reason = $4,
          has_discrepancy = $5
      WHERE id = $6
      `,
      [
        total,
        req.user.id,
        difference,
        closingReason,
        hasDiscrepancy,
        businessDay.id
      ]
    );

    await client.query("COMMIT");

    /* ===============================
       SEND EMAIL AFTER COMMIT
    =============================== */

    if (emailPayload) {
      sendDiscrepancyEmail(emailPayload)
        .catch(err => console.error("Email failed:", err));
    }

    res.json({
      message: "Business day closed successfully",
      countedCash: total,
      drawerCash: systemCash,
      expectedCash,
      difference,
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
