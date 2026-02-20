import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

const VALID_DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

/* =========================================
   ADD RECEIVED CASH TO DRAWER
========================================= */
async function addReceivedCash(client, businessDayId, breakdown) {
  let totalReceived = 0;

  for (const note of breakdown) {
    const noteValue = Number(note.note);
    const qty = Number(note.qty);

    if (!VALID_DENOMS.includes(noteValue) || qty <= 0) continue;

    totalReceived += noteValue * qty;

    await client.query(
      `
      INSERT INTO denominations (business_day_id, note_value, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (business_day_id, note_value)
      DO UPDATE
      SET quantity = denominations.quantity + EXCLUDED.quantity
      `,
      [businessDayId, noteValue, qty]
    );
  }

  return totalReceived;
}

/* =========================================
   GREEDY CHANGE (LARGEST FIRST)
========================================= */
async function returnChange(client, businessDayId, changeRequired) {
  let remaining = Number(changeRequired);
  const changeGiven = [];

  const denomRes = await client.query(
    `
    SELECT id, note_value, quantity
    FROM denominations
    WHERE business_day_id = $1
    ORDER BY note_value DESC
    `,
    [businessDayId]
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
        WHERE id = $2
        `,
        [used, row.id]
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
        businessDayId,
        cashBreakdown
      );

      if (totalReceived < total) {
        throw new Error("Insufficient cash received");
      }

      const change = totalReceived - total;

      if (change > 0) {
        changeBreakdown = await returnChange(
          client,
          businessDayId,
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
      businessDayId,
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
       INSERT ORDER
    =============================== */

    const orderResult = await client.query(
      `
      INSERT INTO orders 
      (business_day_id, user_id, customer_name, customer_phone,
       payment_method, total, is_paid, amount_paid, due_amount)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        businessDayId,
        userId,
        customerName || null,
        customerPhone || null,
        paymentMethod,
        total,
        isPaid,
        paidAmount,
        dueAmount
      ]
    );

    const order = orderResult.rows[0];

    const billNumber = `BD-${order.business_day_id}-${String(order.id).padStart(5, "0")}`;

await client.query(
  `UPDATE orders SET bill_number = $1 WHERE id = $2`,
  [billNumber, order.id]
);

order.bill_number = billNumber;

    /* ===============================
       INSERT ORDER ITEMS
    =============================== */

    for (const item of items) {
      await client.query(
        `
        INSERT INTO order_items
        (order_id, menu_item_id, item_name, quantity, price, price_snapshot)
VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [order.id, item.menuItemId,item.name, item.quantity, item.price, item.price]
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
      WHERE is_paid = false
      ORDER BY created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================================
   GET ORDERS BY BUSINESS DAY
========================================= */
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM orders
      ORDER BY created_at DESC
      `
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/bill/:billNumber", authenticate, async (req, res) => {
  try {
    const { billNumber } = req.params;

    const orderRes = await pool.query(
      `
      SELECT id, bill_number, business_day_id, customer_name,
             customer_phone, payment_method, total,
             is_paid, amount_paid, due_amount, created_at
      FROM orders
      WHERE bill_number = $1
      `,
      [billNumber]
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
      WHERE order_id = $1
      `,
      [order.id]
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
WHERE id = $1`,
      [id]
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
      WHERE id = $4
      RETURNING *
      `,
      [
        finalAmountPaid,
        newDue,
        newDue === 0,
        id
      ]
    );

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
WHERE id = $1`,
      [id]
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
WHERE oi.order_id = $1
      `,
      [id]
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
