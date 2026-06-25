import express from "express";
import pool from "../config/db.js";
import logger from "../utils/logger.js";
import { authenticate,requireAdmin } from "../middleware/authMiddleware.js";
import { bankWithEvent } from "../utils/bankLedger.js";
import {
  normalizeDenominations,
  validateDenominations
} from "../utils/denominationUtils.js";
import { logEvent } from "../utils/ledger.js";

const router = express.Router();

const toCents = (v) => Math.round(Number(v) * 100);

/* =========================================
   ADD CASH
========================================= */
async function addCash(client, restaurantId, businessDayId, denomMap) {
  for (const [note, qty] of Object.entries(denomMap)) {
    if (qty <= 0) continue;

    await client.query(
      `
      INSERT INTO denominations
      (restaurant_id,business_day_id,note_value,quantity)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (restaurant_id,business_day_id,note_value)
      DO UPDATE SET quantity = denominations.quantity + EXCLUDED.quantity
      `,
      [restaurantId, businessDayId, note, qty]
    );
  }
}

/* =========================================
   STORE ORDER DENOMINATIONS (RESTORED)
========================================= */
async function storeOrderDenominations(
  client,
  restaurantId,
  orderId,
  businessDayId,
  breakdown,
  type
) {
  if (!breakdown || breakdown.length === 0) return;

  for (const d of breakdown) {
    const note = Number(d.note ?? d.note_value);
    const qty = Number(d.qty ?? d.quantity);

    if (!note || !qty || qty <= 0) continue;

    await client.query(
      `
      INSERT INTO order_denominations
      (restaurant_id, order_id, business_day_id, note_value, quantity, type)
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [restaurantId, orderId, businessDayId, note, qty, type]
    );
  }
}

/* =========================================
   RETURN CHANGE (LOCK SAFE)
========================================= */
async function returnChange(client, restaurantId, businessDayId, changeCents) {
  let remaining = changeCents;
  const change = [];

  const rows = await client.query(
    `
    SELECT id, note_value, quantity
    FROM denominations
    WHERE restaurant_id=$1 AND business_day_id=$2
    ORDER BY note_value DESC
    FOR UPDATE
    `,
    [restaurantId, businessDayId]
  );

  for (const row of rows.rows) {
    if (remaining <= 0) break;

    const noteCents = toCents(row.note_value);
    const available = Number(row.quantity);

    const needed = Math.floor(remaining / noteCents);
    const used = Math.min(needed, available);

    if (used > 0) {
      remaining -= used * noteCents;

      await client.query(
        `UPDATE denominations SET quantity = quantity - $1 WHERE id=$2`,
        [used, row.id]
      );

      change.push({ note: Number(row.note_value), qty: used });
    }
  }

  if (remaining !== 0) {
    throw new Error("Insufficient change in drawer");
  }

  return change;
}

async function processPayment({
  client,
  restaurantId,
  businessDayId,
  paymentMethod,
  totalCents,
  cashBreakdown,
  manualChangeBreakdown,
  amountPaid,
  currency
}) {
  let paidCents = 0;
  let dueCents = 0;
  let changeBreakdown = [];
  let paymentSplits = [];

  /* =========================
     CASH
  ========================= */
  if (paymentMethod === "cash") {
  if (!cashBreakdown) throw new Error("Cash breakdown required");

  let denomMap = {};
  for (const d of cashBreakdown) {
    denomMap[d.note] = (denomMap[d.note] || 0) + d.qty;
  }

  denomMap = normalizeDenominations(denomMap, currency);

  const receivedCents = Object.entries(denomMap).reduce(
    (sum, [n, q]) => sum + toCents(n) * q,
    0
  );

  validateDenominations(denomMap, receivedCents / 100, currency);

  if (receivedCents < totalCents) {
    throw new Error("Insufficient cash");
  }

  await addCash(client, restaurantId, businessDayId, denomMap);

  const changeCents = receivedCents - totalCents;

  if (changeCents > 0) {

    /* =========================
       MANUAL CHANGE VALIDATION 🔥
    ========================= */
    if (manualChangeBreakdown) {
      const manualCents = manualChangeBreakdown.reduce(
        (sum, d) => sum + toCents(d.note) * d.qty,
        0
      );

      if (manualCents !== changeCents) {
        throw new Error("Incorrect change provided");
      }

      changeBreakdown = manualChangeBreakdown;

      for (const d of manualChangeBreakdown) {
  const check = await client.query(
    `
    SELECT quantity
    FROM denominations
    WHERE restaurant_id=$1 
    AND business_day_id=$2 
    AND note_value=$3
    FOR UPDATE
    `,
    [restaurantId, businessDayId, d.note]
  );

  const available = Number(check.rows[0]?.quantity || 0);

  if (available < d.qty) {
    throw new Error(`Insufficient ₹${d.note} for change`);
  }

  await client.query(
    `
    UPDATE denominations
    SET quantity = quantity - $1
    WHERE restaurant_id=$2 
    AND business_day_id=$3 
    AND note_value=$4
    `,
    [d.qty, restaurantId, businessDayId, d.note]
  );
}

    } else {
      changeBreakdown = await returnChange(
        client,
        restaurantId,
        businessDayId,
        changeCents
      );
    }
  }

  paidCents = totalCents;

  paymentSplits.push({
    method: "cash",
    amount: totalCents / 100
  });
}

  /* =========================
     ONLINE / CARD
  ========================= */
  if (paymentMethod === "online" || paymentMethod === "card") {
    paidCents = totalCents;

    paymentSplits.push({
      method: paymentMethod,
      amount: totalCents / 100
    });
  }

  /* =========================
     MIXED
  ========================= */
  if (paymentMethod?.startsWith("mixed")) {
    if (!cashBreakdown) throw new Error("Cash required for mixed");

    let denomMap = {};
    for (const d of cashBreakdown) {
      denomMap[d.note] = (denomMap[d.note] || 0) + d.qty;
    }

    denomMap = normalizeDenominations(denomMap, currency);

    const cashCents = Object.entries(denomMap).reduce(
      (sum, [n, q]) => sum + toCents(n) * q,
      0
    );

    if (cashCents > totalCents) {
      throw new Error("Cash exceeds total");
    }

    await addCash(client, restaurantId, businessDayId, denomMap);

    const digitalCents = totalCents - cashCents;

    paidCents = totalCents;

    if (cashCents > 0) {
      paymentSplits.push({
        method: "cash",
        amount: cashCents / 100
      });
    }

    if (digitalCents > 0) {
      paymentSplits.push({
        method: paymentMethod === "mixed-online" ? "online" : "card",
        amount: digitalCents / 100
      });
    }
  }

  /* =========================
     UNPAID (PARTIAL)
  ========================= */
  if (paymentMethod === "unpaid") {
    const partialCents = toCents(amountPaid || 0);

    if (partialCents >= totalCents) {
      throw new Error("Partial must be less than total");
    }

    if (partialCents > 0) {
      if (!cashBreakdown) throw new Error("Cash breakdown required");

      let denomMap = {};
      for (const d of cashBreakdown) {
        denomMap[d.note] = (denomMap[d.note] || 0) + d.qty;
      }

      denomMap = normalizeDenominations(denomMap, currency);

      const receivedCents = Object.entries(denomMap).reduce(
        (sum, [n, q]) => sum + toCents(n) * q,
        0
      );

      if (receivedCents !== partialCents) {
        throw new Error("Partial mismatch");
      }

      await addCash(client, restaurantId, businessDayId, denomMap);

      paymentSplits.push({
        method: "cash",
        amount: partialCents / 100
      });
    }

    paidCents = partialCents;
    dueCents = totalCents - partialCents;
  }

  return {
    paidCents,
    dueCents,
    changeBreakdown,
    paymentSplits,
    isPaid: dueCents === 0
  };
}

async function processRefund({
  client,
  restaurantId,
  businessDayId,
  orderId,
  refundCents,
  manualChangeBreakdown,
  userId
})
{
  if (refundCents <= 0) {
    throw new Error("Invalid refund amount");
  }

  /* =========================
     GET PAYMENT SPLITS
  ========================= */
  const payments = await client.query(
    `
    SELECT payment_method, SUM(amount) as amount
    FROM order_payments
    WHERE order_id=$1
    GROUP BY payment_method
    `,
    [orderId]
  );

  let remaining = refundCents;
  let changeBreakdown = [];

  for (const p of payments.rows) {
    if (remaining <= 0) break;

    const methodAmount = Number(p.amount);
    const refundPart = Math.min(remaining, toCents(methodAmount));
    remaining -= refundPart;

    /* =========================
       CASH REFUND
    ========================= */
    if (p.payment_method === "cash") {

      const cashRefund = await processCashRefund({
        client,
        restaurantId,
        businessDayId,
        refundCents: refundPart,
        manualChangeBreakdown
      });

      if (cashRefund.changeBreakdown?.length) {
        await storeOrderDenominations(
          client,
          restaurantId,
          orderId,
          businessDayId,
          cashRefund.changeBreakdown,
          "refund_given"
        );
      }

      changeBreakdown.push(...cashRefund.changeBreakdown);

      await logEvent(client, {
  restaurantId,
  businessDayId,
  entityType: "cash",
  entityId: orderId,
  eventType: "cash_refund",
  amount: -refundPart,
  metadata: { source: "order" },
  userId
});
    }

    /* =========================
       DIGITAL REFUND
    ========================= */
   else {
  let bank = await client.query(
    `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
    [restaurantId]
  );

  if (!bank.rows.length) {
    bank = await client.query(
      `INSERT INTO bank_accounts (restaurant_id, name) VALUES ($1, 'Default Account') RETURNING id`,
      [restaurantId]
    );
  }

  // ✅ ACTUAL BALANCE UPDATE
  await bankWithEvent(client, {
  restaurantId,
  businessDayId,
  bankAccountId: bank.rows[0].id,
  amount: refundPart,
  type: "debit",
  source: "refund",
  referenceId: orderId,
  userId
});
}
  }

  return { changeBreakdown };
}

async function processCashRefund({
  client,
  restaurantId,
  businessDayId,
  refundCents,
  manualChangeBreakdown
}) {
  let changeBreakdown = [];

  if (manualChangeBreakdown) {
    changeBreakdown = manualChangeBreakdown;

    for (const d of manualChangeBreakdown) {
      const check = await client.query(
        `SELECT quantity FROM denominations
         WHERE restaurant_id=$1 AND business_day_id=$2 AND note_value=$3
         FOR UPDATE`,
        [restaurantId, businessDayId, d.note]
      );

      const available = Number(check.rows[0]?.quantity || 0);
      if (available < d.qty) {
        throw new Error(`Insufficient ₹${d.note} for refund`);
      }

      await client.query(
        `UPDATE denominations SET quantity = quantity - $1
         WHERE restaurant_id=$2 AND business_day_id=$3 AND note_value=$4`,
        [d.qty, restaurantId, businessDayId, d.note]
      );
    }
  } else {
    changeBreakdown = await returnChange(
      client,
      restaurantId,
      businessDayId,
      refundCents
    );
  }

  return { changeBreakdown };
}


// ⚠️ This only logs mismatch. It does NOT block transaction.
// Used for debugging / monitoring, not enforcement.
async function validateDrawerConsistency(client, restaurantId, businessDayId) {
  const ledger = await client.query(`
    SELECT COALESCE(SUM(amount),0) as total
    FROM ledger_events
    WHERE restaurant_id=$1
    AND business_day_id=$2
    AND entity_type='cash'
  `, [restaurantId, businessDayId]);

  const physical = await client.query(`
    SELECT COALESCE(SUM(note_value * quantity),0) as total
    FROM denominations
    WHERE restaurant_id=$1 AND business_day_id=$2
  `, [restaurantId, businessDayId]);

  const ledgerCash = Number(ledger.rows[0].total);
  const physicalCash = Number(physical.rows[0].total);

  if (ledgerCash !== physicalCash) {
    logger.warn({ ledgerCash, physicalCash }, "⚠️ Cash mismatch");
  }
}

function validateOrderInput({ items, paymentMethod }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart empty");
  }

  if (!paymentMethod) {
    throw new Error("Payment method required");
  }
}
/* =========================================
   CREATE ORDER
========================================= */
router.post("/", authenticate, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      items,
      paymentMethod,
      cashBreakdown,
      discount,
      amountPaid,
      customerName,
      customerPhone,
      idempotencyKey
    } = req.body;

    const { restaurantId, businessDayId, userId } = req;

    if (!idempotencyKey) throw new Error("Idempotency required");
    validateOrderInput({ items, paymentMethod });

    if (req.settings.use_business_day && !req.businessDayId) {
  throw new Error("Business day not active");
}

if (paymentMethod === "unpaid") {
  if (!customerName || !customerPhone) {
    throw new Error("Customer details required for credit");
  }
}

    await client.query("BEGIN");

    /* =========================
       IDEMPOTENCY
    ========================= */
    const existing = await client.query(
      `SELECT id FROM orders WHERE idempotency_key=$1`,
      [idempotencyKey]
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.json({ message: "Already processed" });
    }

    /* =========================
       TOTAL CALC (CENTS SAFE)
    ========================= */
    const subtotalCents = items.reduce(
      (sum, i) => sum + toCents(i.price) * Number(i.quantity),
      0
    );

    const discountCents = toCents(discount || 0);

    if (discountCents > subtotalCents) {
  throw new Error("Discount exceeds subtotal");
}

    const totalCents = Math.max(0, subtotalCents - discountCents);

    /* =========================
       PAYMENT ENGINE 🔥
    ========================= */
    const payment = await processPayment({
      client,
      restaurantId,
      businessDayId,
      paymentMethod,
      totalCents,
      cashBreakdown,
      manualChangeBreakdown: req.body.manualChangeBreakdown,
      amountPaid,
      currency: req.settings.currency.code
    });

    /* =========================
       BILL SEQUENCE
    ========================= */
    const seq = await client.query(
      `
      INSERT INTO bill_sequences (restaurant_id,business_day_id,last_seq)
      VALUES ($1,$2,1)
      ON CONFLICT (restaurant_id,business_day_id)
      DO UPDATE SET last_seq = bill_sequences.last_seq + 1
      RETURNING last_seq
      `,
      [restaurantId, businessDayId]
    );

    const billSeq = seq.rows[0].last_seq;
    const billNumber = `BD-${businessDayId}-${String(billSeq).padStart(5, "0")}`;

    /* =========================
       INSERT ORDER
    ========================= */
    const orderRes = await client.query(
      `
      INSERT INTO orders
      (
        restaurant_id,
        business_day_id,
        user_id,
        customer_name,
        customer_phone,
        payment_method,
        total,
        is_paid,
        amount_paid,
        due_amount,
        bill_seq,
        bill_number,
        idempotency_key
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
      `,
      [
        restaurantId,
        businessDayId,
        userId,
        customerName || null,
        customerPhone || null,
        paymentMethod,
        totalCents / 100,
        payment.isPaid,
        payment.paidCents / 100,
        payment.dueCents / 100,
        billSeq,
        billNumber,
        idempotencyKey
      ]
    );

    const order = orderRes.rows[0];

    /* =========================
       STORE ITEMS
    ========================= */
    for (const item of items) {

  if (!item.menuItemId || !item.quantity || item.quantity <= 0) {
    throw new Error("Invalid item structure");
  }

  const menuCheck = await client.query(
    `
    SELECT id, price, name
    FROM menu
    WHERE restaurant_id=$1 
    AND id=$2 
    AND is_active=TRUE
    FOR SHARE
    `,
    [restaurantId, item.menuItemId]
  );

  if (!menuCheck.rows.length) {
    throw new Error("Invalid menu item");
  }

  const dbItem = menuCheck.rows[0];

  const dbPrice = Number(dbItem.price);
  const dbName = dbItem.name;

  await client.query(
    `
    INSERT INTO order_items
    (restaurant_id,order_id,menu_item_id,item_name,quantity,price,price_snapshot)
    VALUES ($1,$2,$3,$4,$5,$6,$6)
    `,
    [
      restaurantId,
      order.id,
      item.menuItemId,
      dbName,            // from DB (not frontend)
      Number(item.quantity),
      dbPrice            // from DB (not frontend)
    ]
  );

  await client.query(
    `
    UPDATE menu
    SET usage_count = usage_count + $1
    WHERE restaurant_id=$2 AND id=$3
    `,
    [
      Number(item.quantity),
      restaurantId,
      item.menuItemId
    ]
  );
}

    /* =========================
       STORE PAYMENT SPLITS 🔥
    ========================= */
    for (let i = 0; i < payment.paymentSplits.length; i++) {
      const p = payment.paymentSplits[i];
      const splitKey = payment.paymentSplits.length > 1
        ? `${idempotencyKey}_${i}`
        : idempotencyKey;
      await client.query(
        `
        INSERT INTO order_payments
        (restaurant_id,order_id,payment_method,amount,idempotency_key)
        VALUES ($1,$2,$3,$4,$5)
        `,
        [restaurantId, order.id, p.method, p.amount, splitKey]
      );
    }

    /* =========================
       CASH LEDGER
    ========================= */
    const cashAmount = payment.paymentSplits
  .filter(p => p.method === "cash")
  .reduce((sum, p) => sum + p.amount, 0);

if (cashAmount > 0) {
  await logEvent(client, {
    restaurantId,
    businessDayId,
    entityType: "cash",
    entityId: order.id,
    eventType: "cash_sale",
    amount: cashAmount,
    metadata: { payment: "cash" },
    userId
  });
}

    /* =========================
       BANK LEDGER
    ========================= */
    const digitalAmount = payment.paymentSplits
      .filter(p => p.method !== "cash")
      .reduce((sum, p) => sum + p.amount, 0);

    if (digitalAmount > 0) {
      let bank = await client.query(
        `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
        [restaurantId]
      );

      if (!bank.rows.length) {
        bank = await client.query(
          `INSERT INTO bank_accounts (restaurant_id, name) VALUES ($1, 'Default Account') RETURNING id`,
          [restaurantId]
        );
      }

      await bankWithEvent(client, {
  restaurantId,
  businessDayId,
  bankAccountId: bank.rows[0].id,
  amount: digitalAmount,
  type: "credit",
  source: "order_payment",
  referenceId: order.id,
  userId
});

    }



    /* =========================
       STORE DENOMS 🔥 (CRITICAL)
    ========================= */
    if (cashBreakdown?.length) {
      await storeOrderDenominations(
        client,
        restaurantId,
        order.id,
        businessDayId,
        cashBreakdown,
        "received"
      );
    }

    if (payment.changeBreakdown?.length) {
  await logEvent(client, {
    restaurantId,
    businessDayId,
    entityType: "cash",
    entityId: order.id,
    eventType: "change_given",
    amount: -payment.changeBreakdown.reduce(
  (s, d) => s + (toCents(d.note) * d.qty) / 100,
  0
),
    metadata: { changeBreakdown: payment.changeBreakdown },
    userId
  });
}

    if (payment.changeBreakdown?.length) {
      await storeOrderDenominations(
        client,
        restaurantId,
        order.id,
        businessDayId,
        payment.changeBreakdown,
        "change"
      );
    }

await validateDrawerConsistency(client, restaurantId, businessDayId);

    await client.query("COMMIT");

    res.status(201).json({
      ...order,
      changeBreakdown: payment.changeBreakdown
    });

  } catch (err) {
  await client.query("ROLLBACK");

  if (err.code === "23505") {
    return res.json({ message: "Already processed" });
  }

  next(err);
} finally {
    client.release();
  }
});

/* =========================================
   GET UNPAID ORDERS
========================================= */
router.get("/unpaid", authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        bill_number,
        customer_name,
        customer_phone,
        total,
        amount_paid,
        (total - amount_paid) AS due_amount,
        created_at
      FROM orders
      WHERE restaurant_id=$1
        AND is_paid = false
        AND is_deleted = FALSE
      ORDER BY created_at DESC
    `, [req.restaurantId]);

    res.json(result.rows);

  } catch (err) {
    req.log.error({ err }, "GET /unpaid error");
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================================
   GET ORDERS
========================================= */
router.get("/", authenticate, async (req, res) => {
  try {
    const { businessDayId, date } = req.query;

    let query, params;
    const limitClause = req.user.role === "STAFF" ? "LIMIT 10" : "";

    if (businessDayId) {
      const bid = parseInt(businessDayId, 10);
      if (isNaN(bid)) return res.status(400).json({ message: "Invalid businessDayId" });

      query = `
        SELECT
          o.*,
          u.name AS created_by_name,
          COALESCE(
            json_agg(json_build_object('method', op.payment_method, 'amount', op.amount))
            FILTER (WHERE op.id IS NOT NULL),
            '[]'
          ) AS payments
        FROM orders o
        LEFT JOIN order_payments op ON op.order_id = o.id AND op.restaurant_id = $1
        LEFT JOIN users u ON o.user_id = u.id AND u.restaurant_id = $1
        WHERE o.restaurant_id = $1
          AND o.is_deleted = FALSE
          AND o.business_day_id = $2
        GROUP BY o.id, u.name
        ORDER BY o.created_at DESC
        ${limitClause}
      `;
      params = [req.restaurantId, bid];
    } else if (date) {
      query = `
        SELECT
          o.*,
          u.name AS created_by_name,
          COALESCE(
            json_agg(json_build_object('method', op.payment_method, 'amount', op.amount))
            FILTER (WHERE op.id IS NOT NULL),
            '[]'
          ) AS payments
        FROM orders o
        LEFT JOIN order_payments op ON op.order_id = o.id AND op.restaurant_id = $1
        LEFT JOIN users u ON o.user_id = u.id AND u.restaurant_id = $1
        WHERE o.restaurant_id = $1
          AND o.is_deleted = FALSE
          AND DATE(o.created_at) = $2
        GROUP BY o.id, u.name
        ORDER BY o.created_at DESC
        ${limitClause}
      `;
      params = [req.restaurantId, date];
    } else {
      query = `
        SELECT
          o.*,
          u.name AS created_by_name,
          COALESCE(
            json_agg(json_build_object('method', op.payment_method, 'amount', op.amount))
            FILTER (WHERE op.id IS NOT NULL),
            '[]'
          ) AS payments
        FROM orders o
        LEFT JOIN order_payments op ON op.order_id = o.id AND op.restaurant_id = $1
        LEFT JOIN users u ON o.user_id = u.id AND u.restaurant_id = $1
        WHERE o.restaurant_id = $1
          AND o.is_deleted = FALSE
        GROUP BY o.id, u.name
        ORDER BY o.created_at DESC
        ${limitClause}
      `;
      params = [req.restaurantId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);

  } catch (err) {
    req.log.error({ err }, "GET /orders error");
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/deleted", authenticate, requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM orders 
     WHERE restaurant_id=$1 AND is_deleted=TRUE
     ORDER BY created_at DESC`,
    [req.restaurantId]
  );

  res.json(result.rows);
});


router.get("/bill/:billNumber", authenticate, async (req, res) => {

  if (
  req.user.role === "STAFF" &&
  !req.settings.allow_staff_print
) {
  return res.status(403).json({
    message: "Printing disabled for staff"
  });
}

  try {
    const { billNumber } = req.params;

    const orderRes = await pool.query(
      `
      SELECT id, bill_number, business_day_id, customer_name,
             customer_phone, payment_method, total,
             is_paid, amount_paid, due_amount, created_at
      FROM orders
      WHERE restaurant_id=$1 
AND bill_number = $2
AND is_deleted = FALSE
      `,
      [req.restaurantId,billNumber]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderRes.rows[0];

    const itemsRes = await pool.query(
      `
      SELECT 
        menu_item_id,
        item_name,
        quantity,
        price_snapshot
      FROM order_items
      WHERE restaurant_id=$1 AND order_id = $2
      `,
      [req.restaurantId,order.id]
    );

    res.json({
      ...order,
      items: itemsRes.rows,
    });

  } catch (err) {
    req.log.error({ err }, "GET /bill/:billNumber error");
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================
   PAY EXISTING UNPAID ORDER
========================================= */
router.post("/:id/pay", authenticate, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      paymentMethod,
      cashBreakdown,
      idempotencyKey
    } = req.body;

    const { restaurantId, userId } = req;

    req.log.info({ orderId: id, paymentMethod, idempotencyKey, restaurantId }, "[PAY] processing");

    if (!idempotencyKey) {
      throw new Error("Idempotency key required");
    }

    await client.query("BEGIN");


    const existing = await client.query(
  `
  SELECT id
  FROM order_payments
  WHERE order_id=$1 AND (idempotency_key=$2 OR idempotency_key LIKE $3)
  `,
  [id, idempotencyKey, `${idempotencyKey}_%`]
);

if (existing.rows.length) {
  await client.query("ROLLBACK");
  return res.json({ message: "Already processed" });
}

    /* =========================
       FETCH + LOCK ORDER
    ========================= */
    const orderRes = await client.query(
      `
      SELECT *
      FROM orders
      WHERE id=$1 AND restaurant_id=$2 AND is_deleted=FALSE
      FOR UPDATE
      `,
      [id, restaurantId]
    );

    if (!orderRes.rows.length) {
      throw new Error("Order not found");
    }

    const order = orderRes.rows[0];

    if (order.is_paid) {
      throw new Error("Order already fully paid");
    }

    const remainingCents = toCents(order.total) - toCents(order.amount_paid);

    if (remainingCents <= 0) {
      throw new Error("Nothing left to pay");
    }

    /* =========================
       PROCESS PAYMENT 🔥
    ========================= */
    const payment = await processPayment({
      client,
      restaurantId,
      businessDayId: order.business_day_id,
      paymentMethod,
      totalCents: remainingCents,
      manualChangeBreakdown: req.body.manualChangeBreakdown,
      cashBreakdown,
      currency: req.settings.currency.code
    });

    const newPaidCents =
      toCents(order.amount_paid) + payment.paidCents;

    const newDueCents =
      toCents(order.total) - newPaidCents;

    /* =========================
       UPDATE ORDER
    ========================= */
    const updated = await client.query(
      `
      UPDATE orders
      SET amount_paid=$1,
          due_amount=$2,
          is_paid=$3
      WHERE id=$4 AND restaurant_id=$5
      RETURNING *
      `,
      [
        newPaidCents / 100,
        newDueCents / 100,
        newDueCents === 0,
        id,
        restaurantId
      ]
    );

    /* =========================
       STORE PAYMENTS
    ========================= */
    for (let i = 0; i < payment.paymentSplits.length; i++) {
      const p = payment.paymentSplits[i];
      const splitKey = payment.paymentSplits.length > 1
        ? `${idempotencyKey}_${i}`
        : idempotencyKey;
      await client.query(
        `
        INSERT INTO order_payments
        (restaurant_id,order_id,payment_method,amount,idempotency_key)
        VALUES ($1,$2,$3,$4,$5)
        `,
        [restaurantId, id, p.method, p.amount, splitKey]
      );
    }


    /* =========================
       CASH LEDGER
    ========================= */
   const cashAmount = payment.paymentSplits
  .filter(p => p.method === "cash")
  .reduce((sum, p) => sum + p.amount, 0);

if (cashAmount > 0) {
  await logEvent(client, {
    restaurantId,
    businessDayId: order.business_day_id,
    entityType: "cash",
    entityId: id,
    eventType: "cash_sale",
    amount: cashAmount,
    metadata: { source: "unpaid_payment" },
    userId
  });
}




    /* =========================
       BANK LEDGER
    ========================= */
    const digitalAmount = payment.paymentSplits
      .filter(p => p.method !== "cash")
      .reduce((sum, p) => sum + p.amount, 0);

    if (digitalAmount > 0) {
      let bankRes = await client.query(
        `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
        [restaurantId]
      );

      if (!bankRes.rows.length) {
        bankRes = await client.query(
          `INSERT INTO bank_accounts (restaurant_id, name) VALUES ($1, 'Default Account') RETURNING id`,
          [restaurantId]
        );
      }

      const bankAccountId = bankRes.rows[0].id;

      await bankWithEvent(client, {
  restaurantId,
  businessDayId: order.business_day_id,
  bankAccountId,
  amount: digitalAmount,
  type: "credit",
  source: "order_payment",
  referenceId: id,
  userId
});
    }


    

    /* =========================
       STORE DENOMS 🔥
    ========================= */
    if (cashBreakdown?.length) {
      await storeOrderDenominations(
        client,
        restaurantId,
        id,
        order.business_day_id,
        cashBreakdown,
        "received"
      );
    }

    if (payment.changeBreakdown?.length) {
      await storeOrderDenominations(
        client,
        restaurantId,
        id,
        order.business_day_id,
        payment.changeBreakdown,
        "change"
      );
    }

    if (payment.changeBreakdown?.length) {
  await logEvent(client, {
    restaurantId,
    businessDayId: order.business_day_id,
    entityType: "cash",
    entityId: id,
    eventType: "change_given",
    amount: -payment.changeBreakdown.reduce(
      (s, d) => s + (toCents(d.note) * d.qty) / 100,
      0
    ),
    metadata: { changeBreakdown: payment.changeBreakdown },
    userId
  });
}

    await validateDrawerConsistency(client, restaurantId, order.business_day_id);

    await client.query("COMMIT");

    req.log.info({ orderId: id, is_paid: updated.rows[0]?.is_paid }, "[PAY] SUCCESS");

    res.json({
      ...updated.rows[0],
      changeBreakdown: payment.changeBreakdown
    });

  } catch (err) {
  req.log.error({ err, orderId: req.params?.id, code: err.code }, "[PAY] error");
  await client.query("ROLLBACK");

  if (err.code === "23505") {
    return res.json({ message: "Already processed" });
  }

  next(err);
} finally {
    client.release();
  }
});


/* =========================================
   GET ORDER BY ID
========================================= */
router.get("/:id", authenticate, async (req, res) => {

  try {
    const { id } = req.params;
    const orderRes = await pool.query(
      `SELECT id, bill_number, business_day_id, customer_name,
       customer_phone, payment_method, total,
       is_paid, amount_paid, due_amount, created_at
FROM orders
WHERE restaurant_id=$1 AND id = $2 AND is_deleted = FALSE`,
      [req.restaurantId,id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const itemsRes = await pool.query(
      `
      SELECT 
  oi.menu_item_id,
  oi.item_name,
  oi.quantity,
  oi.price_snapshot
FROM order_items oi
WHERE oi.restaurant_id=$1 AND oi.order_id = $2
      `,
      [req.restaurantId, id]
    );

    res.json({
      ...orderRes.rows[0],
      items: itemsRes.rows,
    });

  } catch (err) {
    req.log.error({ err }, "GET /orders/:id error");
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================
   SOFT DELETE ORDER (REVERSIBLE)
========================================= */
router.post("/:id/delete", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { idempotencyKey } = req.body;
    const { restaurantId, userId } = req;

    if (!idempotencyKey) throw new Error("Idempotency required");

    await client.query("BEGIN");

    /* =========================
       FETCH ORDER
    ========================= */
    const orderRes = await client.query(
      `
      SELECT * FROM orders
      WHERE id=$1 AND restaurant_id=$2 AND is_deleted=FALSE
      FOR UPDATE
      `,
      [id, restaurantId]
    );

    if (!orderRes.rows.length) {
      throw new Error("Order not found");
    }

    const order = orderRes.rows[0];

    /* =========================
       IDEMPOTENCY
    ========================= */
    const existing = await client.query(
      `SELECT id FROM refunds WHERE idempotency_key=$1`,
      [idempotencyKey]
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.json({ message: "Already refunded" });
    }

    /* =========================
       CHECK IF ALREADY FULLY REFUNDED
       (items cleared by the refund dialog — skip re-refunding)
    ========================= */
    const itemsCountRes = await client.query(
      `SELECT COUNT(*) FROM order_items WHERE order_id=$1`,
      [id]
    );
    const hasItems = Number(itemsCountRes.rows[0].count) > 0;

    let totalRefund = 0;

    if (hasItems) {
      /* =========================
         GET PAYMENTS
      ========================= */
      await client.query(
        `
        SELECT payment_method, SUM(amount) as amount
        FROM order_payments
        WHERE order_id=$1
        GROUP BY payment_method
        `,
        [id]
      );

      const totalPaid = Number(order.amount_paid);

      if (totalPaid > 0) {
        await processRefund({
          client,
          restaurantId,
          businessDayId: order.business_day_id,
          orderId: id,
          refundCents: toCents(totalPaid),
          manualChangeBreakdown: null,
          userId
        });
        totalRefund = totalPaid;
      }
    }

    /* =========================
       STORE REFUND RECORD
    ========================= */
    await client.query(
      `
      INSERT INTO refunds
      (restaurant_id,order_id,amount,idempotency_key,created_by)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [restaurantId, id, totalRefund, idempotencyKey, userId]
    );

    /* =========================
       MARK DELETED
    ========================= */
    await client.query(
      `UPDATE orders SET is_deleted=TRUE WHERE id=$1 AND restaurant_id=$2`,
      [id, restaurantId]
    );

    await client.query("COMMIT");

    res.json({ message: "Order fully refunded & deleted" });

  }catch (err) {
  await client.query("ROLLBACK");

  if (err.code === "23505") {
    return res.json({ message: "Already processed" });
  }

  next(err);
} finally {
    client.release();
  }
});

router.post("/:id/undo-delete", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
const { restaurantId, userId } = req;

    await client.query("BEGIN");

    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id=$1 AND restaurant_id=$2 AND is_deleted=TRUE FOR UPDATE`,
      [id, restaurantId]
    );

    if (!orderRes.rows.length) {
      throw new Error("Order not found");
    }

    const order = orderRes.rows[0];
const businessDayId = order.business_day_id;

    /* Block restoring a fully-refunded order (items were cleared by the refund dialog) */
    const itemCountRes = await client.query(
      `SELECT COUNT(*) FROM order_items WHERE order_id=$1`,
      [id]
    );
    if (Number(itemCountRes.rows[0].count) === 0) {
      throw new Error("Cannot restore a fully-refunded order — all items were already refunded");
    }

    const payments = await client.query(
      `
      SELECT payment_method, SUM(amount) as amount
      FROM order_payments
      WHERE order_id=$1
      GROUP BY payment_method
      `,
      [id]
    );

    for (const p of payments.rows) {
      const amount = Number(p.amount);


     if (p.payment_method === "cash") {

  await logEvent(client, {
  restaurantId,
  businessDayId: orderRes.rows[0].business_day_id,
  entityType: "cash",
  entityId: id,
  eventType: "cash_sale",
  amount: amount,
  metadata: { source: "undo_delete" },
  userId
});

  /* =========================
     REPLAY DENOMINATIONS (SAFE)
  ========================= */

  const denomRes = await client.query(
    `
    SELECT note_value, quantity, type
    FROM order_denominations
    WHERE order_id=$1
    FOR UPDATE
    `,
    [id]
  );

  for (const row of denomRes.rows) {
    const note = Number(row.note_value);
    const qty = Number(row.quantity);

    if (qty <= 0) continue;

    if (row.type === "received") {
      // 🟢 add back original cash
      await client.query(
        `
        INSERT INTO denominations
        (restaurant_id,business_day_id,note_value,quantity)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (restaurant_id,business_day_id,note_value)
        DO UPDATE SET quantity = denominations.quantity + EXCLUDED.quantity
        `,
        [restaurantId, orderRes.rows[0].business_day_id, note, qty]
      );
    }

    if (row.type === "change" || row.type === "refund_given") {
      // 🔴 remove what was given back
      const check = await client.query(
        `
        SELECT quantity
        FROM denominations
        WHERE restaurant_id=$1 AND business_day_id=$2 AND note_value=$3
        FOR UPDATE
        `,
        [restaurantId, orderRes.rows[0].business_day_id, note]
      );

      const available = Number(check.rows[0]?.quantity || 0);

      if (available < qty) {
        throw new Error(`Undo failed: insufficient ₹${note}`);
      }

      await client.query(
        `
        UPDATE denominations
        SET quantity = quantity - $1
        WHERE restaurant_id=$2 AND business_day_id=$3 AND note_value=$4
        `,
        [qty, restaurantId, orderRes.rows[0].business_day_id, note]
      );
    }
  }
}

      if (p.payment_method !== "cash") {
        const bank = await client.query(
          `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
          [restaurantId]
        );

        if (bank.rows.length) {
          await bankWithEvent(client, {
  restaurantId,
  businessDayId,
  bankAccountId: bank.rows[0].id,
  amount,
  type: "credit",
  source: "refund_reversal",
  referenceId: id,
  userId
});
        }
      }
    }


const totalPaid = Number(orderRes.rows[0].amount_paid);


    await client.query(
      `UPDATE orders SET is_deleted=FALSE WHERE id=$1 AND restaurant_id=$2`,
      [id, restaurantId]
    );


      await validateDrawerConsistency(client, restaurantId, businessDayId);

    await client.query("COMMIT");

    res.json({ message: "Order restored" });

  }catch (err) {
  await client.query("ROLLBACK");

  if (err.code === "23505") {
    return res.json({ message: "Already processed" });
  }

  next(err);
} finally {
    client.release();
  }
});

router.post("/:id/refund", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    // items: [{menu_item_id, qty}]  — qty is how many units to refund (not necessarily the whole row)
    const { items: refundReq, denominations } = req.body;

    const { restaurantId, businessDayId, userId } = req;

    if (!Array.isArray(refundReq) || refundReq.length === 0) {
      throw new Error("No items selected for refund");
    }

    await client.query("BEGIN");

    /* =========================
       LOCK ORDER
    ========================= */
    const orderRes = await client.query(
      `SELECT * FROM orders
       WHERE id=$1 AND restaurant_id=$2
       FOR UPDATE`,
      [id, restaurantId]
    );

    if (!orderRes.rows.length) {
      throw new Error("Order not found");
    }

    const order = orderRes.rows[0];

    /* =========================
       FETCH CURRENT ITEM ROWS
    ========================= */
    const menuItemIds = refundReq.map(r => r.menu_item_id);

    const itemsRes = await client.query(
      `SELECT * FROM order_items
       WHERE order_id=$1 AND menu_item_id = ANY($2)`,
      [id, menuItemIds]
    );

    if (!itemsRes.rows.length) {
      throw new Error("Invalid items");
    }

    /* =========================
       CALC REFUND AMOUNT (by requested qty)
    ========================= */
    let refundAmount = 0;
    for (const req of refundReq) {
      const row = itemsRes.rows.find(r => r.menu_item_id === req.menu_item_id);
      if (!row) continue;
      const refundQty = Math.min(Number(req.qty), Number(row.quantity));
      refundAmount += Number(row.price ?? row.price_snapshot) * refundQty;
    }

    if (refundAmount <= 0) {
      throw new Error("Invalid refund amount");
    }

    // Cap refund at what was actually paid (unpaid orders may have partial payment)
    refundAmount = Math.min(refundAmount, Number(order.amount_paid));

    if (refundAmount <= 0) {
      throw new Error("Nothing was paid on this order to refund");
    }

    /* =========================
       PAYMENT BREAKDOWN — routing logic
       • pure cash order  → cash drawer (fallback EFTPOS)
       • bank / mixed     → EFTPOS only, no drawer check
    ========================= */
    const paymentsRes = await client.query(
      `SELECT * FROM order_payments WHERE order_id=$1`,
      [id]
    );

    const payments = paymentsRes.rows;

    if (!payments.length) {
      throw new Error("No payment records found");
    }

    const hasBankPayment = payments.some(p => p.payment_method !== "cash");

    let cashRefund = 0;
    let bankRefund = 0;

    if (hasBankPayment) {
      // bank or mixed → EFTPOS entirely
      bankRefund = refundAmount;
    } else {
      // pure cash order → try cash drawer
      cashRefund = refundAmount;
    }

    /* =========================
       CASH REFUND (drawer)
    ========================= */
    let cashFallbackToBank = false;
    let changeBreakdown = [];

    if (cashRefund > 0) {
      try {
        const cashResult = await processCashRefund({
          client,
          restaurantId,
          businessDayId,
          refundCents: toCents(cashRefund),
          manualChangeBreakdown: denominations || null,
        });
        changeBreakdown = cashResult.changeBreakdown || [];

        await logEvent(client, {
          restaurantId,
          businessDayId,
          entityType: "cash",
          entityId: Number(id),
          eventType: "cash_refund",
          amount: -toCents(cashRefund) / 100,
          metadata: { source: "item_refund" },
          userId
        });
      } catch (err) {
        // not enough in drawer → fall back to EFTPOS
        cashFallbackToBank = true;
        bankRefund += cashRefund;
        cashRefund = 0;
      }
    }

    /* =========================
       BANK / EFTPOS REFUND
    ========================= */
    if (bankRefund > 0) {
      let bankRes = await client.query(
        `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
        [restaurantId]
      );

      if (!bankRes.rows.length) {
        bankRes = await client.query(
          `INSERT INTO bank_accounts (restaurant_id, name) VALUES ($1, 'Default Account') RETURNING id`,
          [restaurantId]
        );
      }

      const bankAccountId = bankRes.rows[0].id;

      await bankWithEvent(client, {
        restaurantId,
        bankAccountId,
        amount: bankRefund,
        type: "debit",
        source: "refund",
        referenceId: Number(id),
        createdBy: userId,
      });
    }

    /* =========================
       UPDATE / DELETE ITEM ROWS (respects partial qty)
    ========================= */
    for (const req of refundReq) {
      const row = itemsRes.rows.find(r => r.menu_item_id === req.menu_item_id);
      if (!row) continue;

      const refundQty = Math.min(Number(req.qty), Number(row.quantity));
      const newQty = Number(row.quantity) - refundQty;

      if (newQty <= 0) {
        await client.query(
          `DELETE FROM order_items WHERE order_id=$1 AND menu_item_id=$2`,
          [id, req.menu_item_id]
        );
      } else {
        await client.query(
          `UPDATE order_items SET quantity=$1 WHERE order_id=$2 AND menu_item_id=$3`,
          [newQty, id, req.menu_item_id]
        );
      }
    }

    /* =========================
       CHECK REMAINING ITEMS
    ========================= */
    const remainingItemsRes = await client.query(
      `SELECT COUNT(*) FROM order_items WHERE order_id=$1`,
      [id]
    );

    const remainingCount = Number(remainingItemsRes.rows[0].count);

    if (remainingCount === 0) {
      // All items refunded → soft delete
      await client.query(
        `UPDATE orders SET is_deleted=TRUE WHERE id=$1 AND restaurant_id=$2`,
        [id, restaurantId]
      );
    } else {
      // Partial refund → recalc total
      const newTotalRes = await client.query(
        `SELECT SUM(COALESCE(price, price_snapshot) * quantity) as total
         FROM order_items WHERE order_id=$1`,
        [id]
      );

      const newTotal = Number(newTotalRes.rows[0].total) || 0;

      await client.query(
        `UPDATE orders SET total=$1 WHERE id=$2`,
        [newTotal, id]
      );
    }

    await client.query("COMMIT");

    const mode = cashRefund > 0 ? "cash" : "bank";

    res.json({
      success: true,
      refundAmount,
      cashRefund,
      bankRefund,
      fallbackToBank: cashFallbackToBank,
      changeBreakdown,
      mode,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

export default router;
