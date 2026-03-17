import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { sendDiscrepancyEmail } from "../utils/email.js";
import { sendWhatsAppTemplate } from "../services/whatsappService.js";

const router = express.Router();

/* ===============================
   GET CURRENT OPEN BUSINESS DAY
================================ */
router.get("/current", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM business_days
      WHERE restaurant_id = $1
      AND is_closed = false
      ORDER BY id DESC
      LIMIT 1
      `,
      [req.restaurantId]
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
      `
  SELECT id
  FROM business_days
  WHERE restaurant_id = $1
  AND is_closed = false
  ORDER BY id DESC
  LIMIT 1
  `,
  [req.restaurantId]
    );

    if (dayResult.rows.length === 0) {
      return res.status(404).json({ message: "No open business day" });
    }

    const businessDayId = dayResult.rows[0].id;

    const ledgerResult = await pool.query(
      `
      SELECT COALESCE(SUM(amount),0) AS total
      FROM cash_ledger
      WHERE restaurant_id = $1 AND business_day_id = $2
      `,
      [req.restaurantId, businessDayId]
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
      "SELECT id FROM business_days WHERE restaurant_id = $1 AND is_closed = false LIMIT 1",
      [req.restaurantId]
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
      INSERT INTO business_days (restaurant_id, date, is_closed, opening_cash)
VALUES ($1, CURRENT_DATE, false, $2)
      RETURNING *
      `,
      [req.restaurantId, openingCash]
    );


    const businessDay = dayResult.rows[0];

    // 4️⃣ Insert denominations
    for (const d of denominations) {
      const note = Number(d.note);
      const qty = Number(d.qty);

      if (!note || qty <= 0) continue;

      await client.query(
        `
        INSERT INTO denominations (restaurant_id, business_day_id, note_value, quantity)
        VALUES ($1, $2, $3, $4)
        `,
        [req.restaurantId, businessDay.id, note, qty]
      );
    }

    // 5️⃣ Insert opening entry into ledger
    await client.query(
      `
      INSERT INTO cash_ledger (restaurant_id, business_day_id, type, amount)
      VALUES ($1, $2, 'opening', $3)
      `,
      [req.restaurantId, businessDay.id, openingCash]
    );

    const userRes = await client.query(
  "SELECT name FROM users WHERE restaurant_id=$1 AND id = $2",
  [req.restaurantId, req.user.id]
);
    await client.query("COMMIT");

    

const staffName = userRes.rows[0]?.name || "Unknown";
    // await 
    sendWhatsAppTemplate(
  "kangpos_day_opened",
  [
    new Date().toLocaleDateString(),
    staffName,
    new Date().toLocaleTimeString(),
    openingCash
  ]
).catch(err => console.error("WhatsApp failed:", err));

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
      "SELECT * FROM business_days WHERE restaurant_id = $1 AND is_closed = false ORDER BY id DESC LIMIT 1",
      [req.restaurantId]
    );

    if (dayResult.rows.length === 0) {
      throw new Error("No open business day");
    }

    const businessDay = dayResult.rows[0];

    /* ===============================
       CHECK DRAWER (DENOMINATIONS)
    =============================== */

    /* ===============================
   STRICT DENOMINATION CHECK
================================ */

const systemDenomsRes = await client.query(
  `
  SELECT note_value, quantity
  FROM denominations
  WHERE restaurant_id = $1 AND business_day_id = $2
  `,
  [req.restaurantId, businessDay.id]
);

// Convert DB denominations into map
const systemMap = {};
systemDenomsRes.rows.forEach(row => {
  systemMap[row.note_value] = Number(row.quantity);
});

// Convert submitted breakdown into map
const countedMap = {};
breakdown.forEach(d => {
  countedMap[Number(d.note)] = Number(d.qty);
});

// Check exact match
for (const note in systemMap) {
  const systemQty = systemMap[note] || 0;
  const countedQty = countedMap[note] || 0;

  if (systemQty !== countedQty) {
    throw new Error(
      `Denomination mismatch for ₹${note}. System: ${systemQty}, Counted: ${countedQty}`
    );
  }
}

// Also verify no extra notes were submitted
for (const note in countedMap) {
  if (!(note in systemMap) && countedMap[note] > 0) {
    throw new Error(`Unexpected denomination ₹${note} detected`);
  }
}

// Calculate total from DB for safety
const systemCash = Object.entries(systemMap).reduce(
  (sum, [note, qty]) => sum + Number(note) * qty,
  0
);

    /* ===============================
       CHECK LEDGER EXPECTED CASH
    =============================== */

    const ledgerResult = await client.query(
      `
      SELECT COALESCE(SUM(amount),0) AS total
      FROM cash_ledger
      WHERE restaurant_id = $1 AND business_day_id = $2
      `,
      [req.restaurantId, businessDay.id]
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
        (restaurant_id, business_day_id, type, amount)
        VALUES ($1, $2, 'closing_adjustment', $3)
        `,
        [req.restaurantId, businessDay.id, difference]
      );

      // Get closing user name for email
      const userRes = await client.query(
        "SELECT name FROM users WHERE restaurant_id = $1 AND id = $2",
        [req.restaurantId, req.user.id]
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
      WHERE id = $6 AND restaurant_id = $7
      `,
      [
        total,
        req.user.id,
        difference,
        closingReason,
        hasDiscrepancy,
        businessDay.id,
        req.restaurantId
      ]
    );

    const userRes = await client.query(
  "SELECT name FROM users WHERE restaurant_id = $1 AND id = $2",
  [req.restaurantId, req.user.id]
);
    await client.query("COMMIT");
// CASH SALES
const cashSalesRes = await client.query(
  `
  SELECT COALESCE(SUM(amount),0) AS total
  FROM cash_ledger
  WHERE restaurant_id = $1 AND business_day_id = $2
  AND type = 'sale'
  `,
  [req.restaurantId, businessDay.id]
);

const cashSales = Number(cashSalesRes.rows[0].total);

// UPI SALES
const upiSalesRes = await client.query(
  `
  SELECT COALESCE(SUM(total),0) AS total
  FROM orders
  WHERE restaurant_id = $1 AND business_day_id = $2
  AND payment_method = 'online'
  `,
  [req.restaurantId, businessDay.id]
);

const upiSales = Number(upiSalesRes.rows[0].total);

// EXPENSES
const expensesRes = await client.query(
  `
  SELECT COALESCE(SUM(amount),0) AS total
  FROM expenses
  WHERE restaurant_id = $1 AND business_day_id = $2
  `,
  [req.restaurantId, businessDay.id]
);

const expenses = Number(expensesRes.rows[0].total);

const closingCash = total;

const staffName = userRes.rows[0]?.name || "Unknown";
  //  await 
   sendWhatsAppTemplate(
  "kangpos_day_closed",
  [
    new Date().toLocaleDateString(),
    staffName,
    cashSales,
    upiSales,
    expenses,
    closingCash
  ]
).catch(err => console.error("WhatsApp failed:", err));


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
