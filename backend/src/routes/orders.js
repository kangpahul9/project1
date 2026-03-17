import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";
import { addBankTransaction } from "../utils/bankLedger.js";

const router = express.Router();

const VALID_DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

/* =========================================
   ADD RECEIVED CASH TO DRAWER
========================================= */
async function addReceivedCash(client,restaurantId, finalBusinessDayId, breakdown) {
  let totalReceived = 0;

  for (const note of breakdown) {
    const noteValue = Number(note.note);
    const qty = Number(note.qty);

    if (!VALID_DENOMS.includes(noteValue) || qty <= 0) continue;

    totalReceived += noteValue * qty;

    await client.query(
      `
      INSERT INTO denominations (restaurant_id,business_day_id, note_value, quantity)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (restaurant_id,business_day_id, note_value)
      DO UPDATE
      SET quantity = denominations.quantity + EXCLUDED.quantity
      `,
      [restaurantId,finalBusinessDayId, noteValue, qty]
    );
  }

  return totalReceived;
}

/* =========================================
   GREEDY CHANGE (LARGEST FIRST)
========================================= */
async function returnChange(client, restaurantId, finalBusinessDayId, changeRequired) {
  let remaining = Number(changeRequired);
  const changeGiven = [];

  const denomRes = await client.query(
    `
    SELECT id, note_value, quantity
    FROM denominations
    WHERE restaurant_id=$1 AND business_day_id = $2
    ORDER BY note_value DESC
    `,
    [restaurantId,finalBusinessDayId]
  );

  for (const row of denomRes.rows) {
    if (remaining <= 0) break;

    const note = Number(row.note_value);
    const available = Number(row.quantity);

    if (!VALID_DENOMS.includes(note) || available <= 0) continue;

    const needed = Math.floor(remaining / note);
    const used = Math.min(needed, available);

    if (used > 0) {
      remaining -= used * note;
      remaining = Number(remaining.toFixed(2));

      await client.query(
        `
        UPDATE denominations
        SET quantity = quantity - $1
        WHERE restaurant_id=$2 AND id = $3
        `,
        [used, restaurantId, row.id]
      );

      changeGiven.push({
        note_value: note,
        quantity: used,
      });
    }
  }

  if (remaining > 0) {
    throw new Error("Insufficient denominations to return change");
  }

  return changeGiven;
}

/* =========================================
   CREATE ORDER
========================================= */
router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      businessDayId,
      userId,
      customerName,
      customerPhone,
      paymentMethod,
      items,
      cashBreakdown,
      discount,
      amountPaid
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    await client.query("BEGIN");

    /* ===============================
       CALCULATE TOTAL
    =============================== */
const finalBusinessDayId = req.businessDayId
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    let safeDiscount = Number(discount || 0);
    if (safeDiscount < 0) safeDiscount = 0;
    if (safeDiscount > subtotal) safeDiscount = subtotal;

    const total = Math.max(0, subtotal - safeDiscount);

    let changeBreakdown = [];
    let isPaid = true;
    let paidAmount = total;
    let dueAmount = 0;

    /* ===============================
       CASH PAYMENT
    =============================== */

    if (paymentMethod === "cash") {

      if (!cashBreakdown || cashBreakdown.length === 0) {
        throw new Error("Cash breakdown required");
      }

      const totalReceived = await addReceivedCash(
        client,
        req.restaurantId,
        finalBusinessDayId,
        cashBreakdown
      );

      if (totalReceived < total) {
        throw new Error("Insufficient cash received");
      }

      const change = totalReceived - total;

      if (change > 0) {
        changeBreakdown = await returnChange(
          client,
          req.restaurantId,
          finalBusinessDayId,
          change
        );
      }

      paidAmount = total;
      dueAmount = 0;
      isPaid = true;
    }

    /* ===============================
       CREDIT / UNPAID
    =============================== */

    if (paymentMethod === "unpaid") {

  if (!customerName || !customerPhone) {
    throw new Error("Customer name and phone required for credit");
  }

  let partialPaid = Number(amountPaid || 0);

  if (partialPaid < 0 || partialPaid >= total) {
    throw new Error("Partial must be less than total");
  }

  // 🔥 If partial cash is given, update drawer
  if (partialPaid > 0) {

    if (!cashBreakdown || cashBreakdown.length === 0) {
      throw new Error("Cash breakdown required for partial payment");
    }

    const received = await addReceivedCash(
      client,
      req.restaurantId,
      finalBusinessDayId,
      cashBreakdown
    );

    if (received !== partialPaid) {
      throw new Error("Cash mismatch in partial payment");
    }
  }

  paidAmount = partialPaid;
  dueAmount = total - partialPaid;
  isPaid = false;
}


    /* ===============================
       ONLINE / CARD
    =============================== */

    if (paymentMethod === "online" || paymentMethod === "card") {
      paidAmount = total;
      dueAmount = 0;
      isPaid = true;
    }

    /* ===============================
   MIXED PAYMENT
=============================== */

if (paymentMethod.startsWith("mixed"))  {

  if (!cashBreakdown || cashBreakdown.length === 0) {
    throw new Error("Cash breakdown required for mixed payment");
  }

  const totalReceived = await addReceivedCash(
    client,
    req.restaurantId,
    finalBusinessDayId,
    cashBreakdown
  );

  if (totalReceived > total) {
    throw new Error("Cash cannot exceed total in mixed payment");
  }

  const remaining = total - totalReceived;

  // order becomes fully paid
  paidAmount = total;
  dueAmount = 0;
  isPaid = true;

}


await client.query(
`
SELECT id
FROM orders
WHERE restaurant_id = $1
AND business_day_id = $2
FOR UPDATE
`,
[req.restaurantId, finalBusinessDayId]
);


/* ===============================
   GET NEXT BILL SEQ
=============================== */

const seqRes = await client.query(
`
SELECT COALESCE(MAX(bill_seq),0) + 1 AS next_seq
FROM orders
WHERE restaurant_id = $1
AND business_day_id = $2
`,
[req.restaurantId, finalBusinessDayId]
);

const billSeq = seqRes.rows[0].next_seq;

const billNumber =
`BD-${finalBusinessDayId}-${String(billSeq).padStart(5,"0")}`;





    /* ===============================
       INSERT ORDER
    =============================== */

    const orderResult = await client.query(
`
INSERT INTO orders 
(restaurant_id,business_day_id, user_id, customer_name, customer_phone,
 payment_method, total, is_paid, amount_paid, due_amount, bill_seq, bill_number)

VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
RETURNING *
`,
[
  req.restaurantId,
  finalBusinessDayId,
  userId,
  customerName || null,
  customerPhone || null,
  paymentMethod,
  total,
  isPaid,
  paidAmount,
  dueAmount,
  billSeq,
  billNumber
]
);

const order = orderResult.rows[0];




    /* ===============================
       INSERT ORDER ITEMS
    =============================== */

    

    for (const item of items) {

      const menuCheck = await client.query(
`
SELECT id, price
FROM menu
WHERE restaurant_id = $1
AND id = $2
AND is_active = TRUE
`,
[req.restaurantId, item.menuItemId]
);

if (menuCheck.rows.length === 0) {
  throw new Error("Invalid menu item");
}
const dbPrice = Number(menuCheck.rows[0].price);


  await client.query(
    `
    INSERT INTO order_items
    (restaurant_id,order_id, menu_item_id, item_name, quantity, price, price_snapshot)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      req.restaurantId,
      order.id,
      item.menuItemId,
      item.name,
      Number(item.quantity),
      item.price,
      item.price
    ]
  );

  // 🔥 Increase popularity count
  await client.query(
    `
    UPDATE menu
    SET usage_count = usage_count + $1
    WHERE restaurant_id=$2 AND id = $3
    `,
    [
      Number(item.quantity),
      req.restaurantId,
      item.menuItemId
    ]
  );

}
    /* ===============================
   CASH LEDGER ENTRY
=============================== */

/* ===============================
   STORE PAYMENT SPLIT
=============================== */

if (paymentMethod === "cash") {

  await client.query(
    `INSERT INTO order_payments
     (restaurant_id,order_id, payment_method, amount)
     VALUES ($1,$2,'cash',$3)`,
    [req.restaurantId,order.id, total]
  );

}

if (paymentMethod === "online") {

  await client.query(
    `INSERT INTO order_payments
     (restaurant_id,order_id, payment_method, amount)
     VALUES ($1,$2,'online',$3)`,
    [req.restaurantId,order.id, total]
  );

}

if (paymentMethod === "card") {

  await client.query(
    `INSERT INTO order_payments
     (restaurant_id,order_id, payment_method, amount)
     VALUES ($1,$2,'card',$3)`,
    [req.restaurantId,order.id, total]
  );

}

// 🔥 BANK CREDIT (ONLINE / CARD)
if (paymentMethod === "online" || paymentMethod === "card") {

  const bankRes = await client.query(
    `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
    [req.restaurantId]
  );

  const bankAccountId = bankRes.rows[0]?.id;

  if (!bankAccountId) {
    throw new Error("Bank account not configured");
  }

  await addBankTransaction(client, {
    restaurantId: req.restaurantId,
    bankAccountId,
    amount: total,
    type: "credit",
    source: "order",
    referenceId: order.id,
    description: "Customer payment"
  });
}

if (paymentMethod.startsWith("mixed")) {

  const cashAmount = cashBreakdown.reduce(
    (sum, n) => sum + Number(n.note) * Number(n.qty),
    0
  );

  const onlineAmount = total - cashAmount;

  if (onlineAmount > 0) {
    const bankRes = await client.query(
      `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
      [req.restaurantId]
    );

    const bankAccountId = bankRes.rows[0]?.id;

    await addBankTransaction(client, {
      restaurantId: req.restaurantId,
      bankAccountId,
      amount: onlineAmount,
      type: "credit",
      source: "order",
      referenceId: order.id,
      description: "Mixed payment (online/card)"
    });
  }
}

if (paymentMethod.startsWith("mixed"))  {

  const cashAmount = cashBreakdown.reduce(
    (sum, n) => sum + Number(n.note) * Number(n.qty),
    0
  );

  const remaining = total - cashAmount;

  const digitalMethod =
  paymentMethod === "mixed-online" ? "online" : "card";

  if (cashAmount > 0) {
    await client.query(
      `INSERT INTO order_payments
       (restaurant_id,order_id, payment_method, amount)
       VALUES ($1,$2,'cash',$3)`,
      [req.restaurantId,order.id, cashAmount]
    );
  }

  if (remaining > 0) {
    await client.query(
      `INSERT INTO order_payments
       (restaurant_id,order_id, payment_method, amount)
       VALUES ($1, $2, $3, $4)`,
      [req.restaurantId,order.id, digitalMethod, remaining]
    );
  }

}

if (paymentMethod === "cash") {
  await client.query(
    `
    INSERT INTO cash_ledger
    (restaurant_id,business_day_id, type, reference_id, amount)
    VALUES ($1, $2, 'sale', $3, $4)
    `,
    [req.restaurantId,finalBusinessDayId, order.id, total]
  );
}

if (paymentMethod.startsWith("mixed"))  {

  const cashAmount = cashBreakdown.reduce(
    (sum, n) => sum + Number(n.note) * Number(n.qty),
    0
  );

  if (cashAmount > 0) {
    await client.query(
      `
      INSERT INTO cash_ledger
      (restaurant_id,business_day_id, type, reference_id, amount)
      VALUES ($1,$2, 'sale', $3, $4)
      `,
      [req.restaurantId,finalBusinessDayId, order.id, cashAmount]
    );
  }
}

if (paymentMethod === "unpaid" && paidAmount > 0) {
  await client.query(
    `
    INSERT INTO cash_ledger
    (restaurant_id,business_day_id, type, reference_id, amount)
    VALUES ($1, $2, 'sale', $3, $4)
    `,
    [req.restaurantId,finalBusinessDayId, order.id, paidAmount]
  );
}
    await client.query("COMMIT");

    res.status(201).json({
      ...order,
      changeBreakdown,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ message: err.message });
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
        customer_name,
        customer_phone,
        total,
        amount_paid,
        (total - amount_paid) AS due_amount,
        created_at
      FROM orders
      WHERE restaurant_id=$1 AND is_paid = false
      ORDER BY created_at DESC
    `, [req.restaurantId]);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================================
   GET ORDERS 
========================================= */
router.get("/", authenticate, async (req, res) => {
  try {

    let result;

    if (req.user.role === "STAFF") {

      result = await pool.query(
        `
        SELECT
  o.*,
  COALESCE(
    json_agg(
      json_build_object(
        'method', op.payment_method,
        'amount', op.amount
      )
    ) FILTER (WHERE op.id IS NOT NULL),
    '[]'
  ) AS payments
FROM orders o
LEFT JOIN order_payments op
  ON op.order_id = o.id
  AND op.restaurant_id = $1
WHERE o.restaurant_id = $1
GROUP BY o.id
ORDER BY o.created_at DESC
        LIMIT 10
        `,[req.restaurantId]
      );

    } else {

      result = await pool.query(
        `
        SELECT
  o.*,
  COALESCE(
    json_agg(
      json_build_object(
        'method', op.payment_method,
        'amount', op.amount
      )
    ) FILTER (WHERE op.id IS NOT NULL),
    '[]'
  ) AS payments
FROM orders o
LEFT JOIN order_payments op
  ON op.order_id = o.id
  AND op.restaurant_id = $1
WHERE o.restaurant_id = $1
GROUP BY o.id
ORDER BY o.created_at DESC
        `,[req.restaurantId]
      );

    }

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
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
      WHERE restaurant_id=$1 AND bill_number = $2
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
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================
   PAY EXISTING UNPAID ORDER
========================================= */
router.post("/:id/pay", authenticate, async (req, res) => {

  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { payAmount, paymentMethod, cashBreakdown } = req.body;

    await client.query("BEGIN");

    const orderRes = await client.query(
      `SELECT id, bill_number, business_day_id, customer_name,
       customer_phone, payment_method, total,
       is_paid, amount_paid, due_amount, created_at
FROM orders
WHERE restaurant_id=$1 AND id = $2`,
      [req.restaurantId,id]
    );

    if (orderRes.rows.length === 0) {
      throw new Error("Order not found");
    }

    const order = orderRes.rows[0];

    if (order.is_paid) {
      throw new Error("Order already fully paid");
    }

    let receivedAmount = Number(payAmount || 0);
    let changeBreakdown = [];

    /* ===============================
       CASH PAYMENT FOR UNPAID
    =============================== */

    if (paymentMethod === "cash") {

      if (!cashBreakdown || cashBreakdown.length === 0) {
        throw new Error("Cash breakdown required");
      }

      receivedAmount = await addReceivedCash(
        client,
        req.restaurantId,
        order.business_day_id,
        cashBreakdown
      );

      if (receivedAmount <= 0) {
        throw new Error("Invalid cash amount");
      }
    }

    /* ===============================
       VALIDATE PAYMENT
    =============================== */

    const newAmountPaid = Number(order.amount_paid) + receivedAmount;

    if (newAmountPaid > order.total) {
      const extra = newAmountPaid - order.total;

      if (paymentMethod === "cash") {
        changeBreakdown = await returnChange(
          client,
          req.restaurantId,
          order.business_day_id,
          extra
        );
      }

      receivedAmount = order.total - Number(order.amount_paid);
    }

    const finalAmountPaid =
      Number(order.amount_paid) + receivedAmount;

    const newDue = Number(order.total) - finalAmountPaid;

    const updated = await client.query(
      `
      UPDATE orders
      SET amount_paid = $1,
          due_amount = $2,
          is_paid = $3
      WHERE restaurant_id=$4 AND id = $5
      RETURNING *
      `,
      [
        finalAmountPaid,
        newDue,
        newDue === 0,
        req.restaurantId,
        id
      ]
    );

    /* ===============================
   LEDGER ENTRY FOR CASH PAYMENT
=============================== */

if (paymentMethod === "cash" && receivedAmount > 0) {
  await client.query(
    `
    INSERT INTO cash_ledger
    (restaurant_id,business_day_id, type, reference_id, amount)
    VALUES ($1, $2, 'sale', $3, $4)
    `,
    [req.restaurantId,order.business_day_id, order.id, receivedAmount]
  );
}

await client.query(
`
INSERT INTO order_payments
(restaurant_id,order_id, payment_method, amount)
VALUES ($1,$2,$3,$4)
`,
[
  req.restaurantId,
order.id,
paymentMethod === "cash"
? "cash"
: paymentMethod === "card"
? "card"
: "online",
receivedAmount
]
);

// 🔥 BANK CREDIT (for online/card payment of unpaid order)
if (
  (paymentMethod === "online" || paymentMethod === "card") &&
  receivedAmount > 0
) {
  const bankRes = await client.query(
    `SELECT id FROM bank_accounts WHERE restaurant_id=$1 LIMIT 1`,
    [req.restaurantId]
  );

  const bankAccountId = bankRes.rows[0]?.id;

  if (!bankAccountId) {
    throw new Error("Bank account not configured");
  }

  await addBankTransaction(client, {
    restaurantId: req.restaurantId,
    bankAccountId,
    amount: receivedAmount,
    type: "credit",
    source: "order",
    referenceId: order.id,
    description: "Unpaid order payment"
  });
}

    await client.query("COMMIT");

    res.json({
      ...updated.rows[0],
      changeBreakdown
    });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: err.message });
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
WHERE restaurant_id=$1 AND id = $2`,
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
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
