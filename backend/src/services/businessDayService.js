import logger from "../utils/logger.js";
import { logEvent } from "../utils/ledger.js";
/* ===============================
   CLOSE BUSINESS DAY
================================ */
export async function closeBusinessDay({
  client,
  restaurantId,
  userId,
  breakdown,
  total,
  reason,
  currency = "AUD"
}) {
  const totalNum = Number(total);

  if (!Array.isArray(breakdown) || isNaN(totalNum)) {
    throw new Error("Invalid closing data");
  }

  const dayRes = await client.query(
    `SELECT * FROM business_days
     WHERE restaurant_id=$1 AND is_closed=false
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [restaurantId]
  );

  if (!dayRes.rows.length) {
    throw new Error("No open business day");
  }

  const businessDay = dayRes.rows[0];

  /* ===============================
     DENOMINATION VALIDATION
  ============================== */
  const denomRes = await client.query(
    `SELECT note_value, quantity FROM denominations
     WHERE restaurant_id=$1 AND business_day_id=$2
     ORDER BY note_value DESC`,
    [restaurantId, businessDay.id]
  );
  const sysDenoms = denomRes.rows;

  for (const { note, qty } of breakdown) {
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      throw new Error("Invalid denomination values");
    }
  }

  const sysMap = Object.fromEntries(
    sysDenoms.map(d => [String(d.note_value), Number(d.quantity)])
  );
  for (const { note, qty } of breakdown) {
    const key = String(note);
    if (!(key in sysMap)) {
      throw new Error(`Unexpected denomination ₹${note}`);
    }
    if (qty !== sysMap[key]) {
      throw new Error(`Denomination mismatch for ₹${note}`);
    }
  }

  /* ===============================
     LEDGER CHECK
  ============================== */
  const ledger = await client.query(`
  SELECT COALESCE(SUM(amount),0) AS total
  FROM ledger_events
  WHERE restaurant_id=$1 
  AND business_day_id=$2
  AND entity_type='cash'
`, [restaurantId, businessDay.id]);

  const expectedCash = Number(ledger.rows[0].total);
  const diffInCents =
  Math.round(totalNum * 100) - Math.round(expectedCash * 100);

const difference = diffInCents / 100;


  if (diffInCents !== 0 && (!reason || reason.trim() === "")) {
    throw new Error("Closing reason required");
  }

  if (diffInCents !== 0) {
    await logEvent(client, {
  restaurantId,
  businessDayId: businessDay.id,
  entityType: "cash",
  entityId: businessDay.id,
  eventType: "closing_adjustment",
  amount: difference,
  metadata: { reason: reason || "Mismatch" },
  userId
});
  }

  await client.query(
    `UPDATE business_days
     SET is_closed=true,
         closing_cash=$1,
         closed_by=$2,
         closing_difference=$3,
         closing_reason=$4,
         has_discrepancy=$5
     WHERE id=$6 AND restaurant_id=$7`,
    [
      totalNum,
      userId,
      difference,
      reason || null,
      diffInCents !== 0,
      businessDay.id,
      restaurantId
    ]
  );

  logger.info(
    { restaurantId, businessDayId: businessDay.id },
    "Business day closed"
  );

  return {
    businessDayId: businessDay.id,
    expectedCash,
    difference,
    hasDiscrepancy: diffInCents !== 0
  };
}

/* ===============================
   DAY SUMMARY
================================ */
export async function getDaySummary(client, restaurantId, businessDayId) {
 const cashSalesRes = await client.query(`
  SELECT COALESCE(SUM(amount),0) AS total
  FROM ledger_events
  WHERE restaurant_id=$1 
  AND business_day_id=$2
  AND event_type='cash_sale'
`, [restaurantId, businessDayId]);

  const upiSalesRes = await client.query(
    `SELECT COALESCE(SUM(total),0) AS total
     FROM orders
     WHERE restaurant_id=$1 AND business_day_id=$2
     AND payment_method='online'`,
    [restaurantId, businessDayId]
  );

  const expensesRes = await client.query(
    `SELECT COALESCE(SUM(amount),0) AS total
     FROM expenses
     WHERE restaurant_id=$1 AND business_day_id=$2`,
    [restaurantId, businessDayId]
  );

  return {
    cashSales: Number(cashSalesRes.rows[0].total),
    upiSales: Number(upiSalesRes.rows[0].total),
    expenses: Number(expensesRes.rows[0].total)
  };
}