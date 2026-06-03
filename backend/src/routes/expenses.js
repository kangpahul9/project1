import express from "express";
import fs from "fs";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import {uploadSingle} from "../middleware/upload.js";
import { bankWithEvent } from "../utils/bankLedger.js";
import {
  normalizeDenominations,
  validateDenominations
} from "../utils/denominationUtils.js";
import { deductCash } from "../utils/cashUtils.js";
import { logEvent } from "../utils/ledger.js";
import OpenAI from "openai";

const router = express.Router();

/* =========================================
   CONSTANTS
========================================= */
const VALID_PAYMENT_MODES = ["cash", "online", "card"];

/* =========================================
   CREATE EXPENSE
========================================= */
router.post("/", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    let {
      amount,
      category,
      description,
      paymentMode,
      vendorId,
      staff_id,
      document_url,
      is_paid,
      deduct_from_galla,
      denominations,
      source,
      partnerId,
      date,
      idempotencyKey
    } = req.body;

    const { restaurantId, userId } = req;
    let { businessDayId } = req;

    const amountNum = Number(amount);
    const amountCents = Math.round(amountNum * 100);

    /* =========================
       VALIDATION
    ========================= */
    if (!amountNum || amountNum <= 0) {
      throw new Error("Invalid amount");
    }

    if (!category) {
      throw new Error("Category required");
    }

    if (!VALID_PAYMENT_MODES.includes(paymentMode)) {
      throw new Error("Invalid payment mode");
    }

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new Error("Idempotency key required");
    }

    if (category === "supplies" && !vendorId) {
      throw new Error("Vendor required for supplies");
    }

    if (category === "salary" && !staff_id) {
      throw new Error("Staff required for salary expense");
    }
if (req.settings.use_business_day) {
  if (!req.businessDayId) {
    throw new Error("Business day not active");
  }

  // 🔥 FORCE SERVER VALUE
  businessDayId = req.businessDayId;
}
    

    const expenseDate = date ? new Date(date) : new Date();

    await client.query("BEGIN");

    /* =========================
       IDEMPOTENCY CHECK
    ========================= */
    const existing = await client.query(
      `SELECT id FROM expenses
       WHERE restaurant_id=$1 AND idempotency_key=$2`,
      [restaurantId, idempotencyKey]
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.json({ message: "Already processed" });
    }

    /* =========================
       VALIDATE PARTNER
    ========================= */
    if (partnerId) {
      const check = await client.query(
        `SELECT id FROM partners WHERE id=$1 AND restaurant_id=$2`,
        [partnerId, restaurantId]
      );

      if (!check.rows.length) {
        throw new Error("Invalid partner");
      }
    }

    /* =========================
       VALIDATE VENDOR
    ========================= */
    if (vendorId) {
      const check = await client.query(
        `SELECT id FROM vendors WHERE id=$1 AND restaurant_id=$2`,
        [vendorId, restaurantId]
      );

      if (!check.rows.length) {
        throw new Error("Invalid vendor");
      }
    }

    let withdrawalId = null;

    /* =========================
       CASH (GALLA) HANDLING
    ========================= */
    if (paymentMode === "cash" && deduct_from_galla) {
      if (req.settings.use_business_day && !req.businessDayId) {
  throw new Error("Business day not active");
}

      if (!denominations || typeof denominations !== "object") {
        throw new Error("Denominations required");
      }

      const normalized = normalizeDenominations(
        denominations,
        req.settings.currency.code
      );

      validateDenominations(
        normalized,
        amountNum,
        req.settings.currency.code
      );

      await deductCash(
        client,
        restaurantId,
        businessDayId,
        normalized
      );

      let reason = "Other";
      if (category === "utility") reason = "Utilities";
      if (category === "supplies") reason = "Supplier Payment";
      if (category === "salary") reason = "Staff Salary";

      const withdrawalRes = await client.query(
        `
        INSERT INTO cash_withdrawals
        (restaurant_id, business_day_id, amount, user_id, partner_id, reason)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id
        `,
        [
          restaurantId,
          businessDayId,
          amountNum,
          partnerId ? null : userId,
          partnerId || null,
          reason
        ]
      );

      withdrawalId = withdrawalRes.rows[0].id;
await logEvent(client, {
  restaurantId,
  businessDayId,
  entityType: "cash",
  entityId: withdrawalId,
  eventType: "cash_withdrawal",
  amount: -amountNum,
  metadata: { category },
  userId
});
      
    }

    /* =========================
       INSERT EXPENSE
    ========================= */
    const expenseRes = await client.query(
      `
      INSERT INTO expenses
      (
        restaurant_id,
        business_day_id,
        vendor_id,
        amount,
        category,
        description,
        payment_method,
        user_id,
        partner_id,
        staff_id,
        document_url,
        is_paid,
        source,
        expense_date,
        idempotency_key
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
      `,
      [
        restaurantId,
        businessDayId,
        vendorId || null,
        amountNum,
        category,
        description || null,
        paymentMode,
        partnerId ? null : userId,
        partnerId || null,
        staff_id || null,
        document_url || null,
        is_paid || false,
        source || "manual",
        expenseDate,
        idempotencyKey
      ]
    );

    const expense = expenseRes.rows[0];


    if (
  paymentMode === "cash" &&
  is_paid &&
  !deduct_from_galla
) {
  await logEvent(client, {
    restaurantId,
    businessDayId,
    entityType: "cash",
    entityId: expense.id,
    eventType: "cash_withdrawal",
    amount: -amountNum,
    metadata: { category, type: "manual_cash" },
    userId
  });
}

    /* =========================
       BANK TRANSACTION
    ========================= */
    if (
      ["online", "card"].includes(paymentMode) &&
      is_paid
    ) {
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
  amount: amountNum,
  type: "debit",
  source: "expense",
  referenceId: expense.id,
  description,
  partnerId,
  createdBy: userId,
  idempotencyKey
});
    }

    /* =========================
       STAFF TRANSACTION
    ========================= */
    if (
      category === "salary" &&
      staff_id &&
      is_paid &&
      source !== "staff_payment"
    ) {
      await client.query(
        `
        INSERT INTO staff_transactions
        (restaurant_id, staff_id, amount, type, reason, business_day_id, expense_id)
        VALUES ($1,$2,$3,'payment','Salary Payment',$4,$5)
        `,
        [
          restaurantId,
          staff_id,
          amountNum,
          businessDayId,
          expense.id
        ]
      );
    }

    await client.query("COMMIT");

    req.log?.info(
      { expenseId: expense.id, restaurantId },
      "Expense created"
    );

    res.status(201).json(expense);

  } catch (err) {
    await client.query("ROLLBACK");
    req.log?.error(err, "Expense creation failed");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   GET ALL EXPENSES
========================================= */
router.get("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        e.*,
        u.name AS created_by,
        s.name AS staff_name,
        v.name AS vendor_name,
        p.name AS partner_name
      FROM expenses e
      LEFT JOIN users u 
        ON e.user_id = u.id AND u.restaurant_id = $1
      LEFT JOIN staff s 
        ON e.staff_id = s.id AND s.restaurant_id = $1
      LEFT JOIN vendors v 
        ON e.vendor_id = v.id AND v.restaurant_id = $1
      LEFT JOIN partners p
        ON e.partner_id = p.id AND p.restaurant_id = $1
      WHERE e.restaurant_id = $1
      ORDER BY COALESCE(e.expense_date, e.created_at) DESC
      LIMIT 500
      `,
      [req.restaurantId]
    );

    res.json(result.rows);

  } catch (err) {
    req.log?.error(err, "Fetch expenses failed");
    next(err);
  }
});

/* =========================================
   UPDATE EXPENSE
========================================= */
router.put("/:id", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    let {
      amount,
      category,
      description,
      paymentMode,
      vendorId,
      is_paid,
      partnerId,
      date,
      staff_id,
      denominations,
      deduct_from_galla,
      idempotencyKey
    } = req.body;

    const { restaurantId, userId } = req;

    const amountNum = Number(amount);

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new Error("Idempotency key required");
    }

    await client.query("BEGIN");

    /* =========================
       IDEMPOTENCY CHECK (FIXED)
    ========================= */
    const existingTxn = await client.query(
      `
      SELECT id FROM bank_transactions
      WHERE idempotency_key = $1
      `,
      [idempotencyKey]
    );

    if (existingTxn.rows.length) {
      await client.query("ROLLBACK");
      return res.json({ message: "Already processed" });
    }

    /* =========================
       LOCK EXPENSE
    ========================= */
    const expenseRes = await client.query(
      `
      SELECT * FROM expenses
      WHERE id=$1 AND restaurant_id=$2
      FOR UPDATE
      `,
      [id, restaurantId]
    );

    if (!expenseRes.rows.length) {
      throw new Error("Expense not found");
    }

    const expense = expenseRes.rows[0];

    /* =========================
       HARD SAFETY RULES
    ========================= */
    if (expense.is_paid && amountNum !== expense.amount) {
      throw new Error("Cannot change amount of paid expense");
    }

    if (expense.is_paid && !is_paid) {
      throw new Error("Cannot unpay settled expense");
    }


    if (!expense.business_day_id && deduct_from_galla) {
      throw new Error("Invalid business day for cash operation");
    }

    const wasUnpaid = !expense.is_paid && is_paid;

    const expenseDate = date
      ? new Date(date)
      : expense.expense_date || new Date();

    let amountPaid = expense.amount_paid;
    let paidAt = expense.paid_at;

    /* =========================
       MARK AS PAID
    ========================= */
    if (wasUnpaid) {
      amountPaid = amountNum;
      paidAt = new Date();

      /* CASH FLOW */
      if (paymentMode === "cash" && deduct_from_galla) {
        if (!denominations) throw new Error("Denominations required");

        const normalized = normalizeDenominations(
          denominations,
          req.settings.currency.code
        );

        validateDenominations(
          normalized,
          amountNum,
          req.settings.currency.code
        );

        await deductCash(
          client,
          restaurantId,
          expense.business_day_id,
          normalized
        );

        await client.query(
          `
          INSERT INTO cash_withdrawals
          (restaurant_id, business_day_id, amount, user_id, partner_id, reason)
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [
            restaurantId,
            expense.business_day_id,
            amountNum,
            partnerId ? null : userId,
            partnerId || null,
            category === "salary"
              ? "Staff Salary"
              : category === "supplies"
              ? "Supplier Payment"
              : "Utilities"
          ]
        );
        
      }

      if (paymentMode === "cash" && is_paid) {
  const isGalla = deduct_from_galla;

  await logEvent(client, {
    restaurantId,
    businessDayId: expense.business_day_id,
    entityType: "cash",
    entityId: isGalla ? withdrawalId : expense.id,
    eventType: "cash_withdrawal",
    amount: -amountNum,
    metadata: {
      category,
      type: isGalla ? "galla" : "manual_cash"
    },
    userId
  });
}

      
      /* BANK FLOW */
      if (["online", "card"].includes(paymentMode)) {
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
  amount: amountNum,
  type: "debit",
  source: "expense",
  referenceId: expense.id,
  description,
  partnerId,
  createdBy: userId,
  idempotencyKey
});
      }

      /* STAFF */
      if (category === "salary" && staff_id) {
        await client.query(
          `
          INSERT INTO staff_transactions
          (restaurant_id, staff_id, amount, type, reason, business_day_id, expense_id)
          VALUES ($1,$2,$3,'payment','Salary Payment',$4,$5)
          `,
          [
            restaurantId,
            staff_id,
            amountNum,
            expense.business_day_id,
            expense.id
          ]
        );
      }
    }

    /* UPDATE */
    const result = await client.query(
      `
      UPDATE expenses
      SET amount=$1,
          category=$2,
          description=$3,
          payment_method=$4,
          vendor_id=$5,
          is_paid=$6,
          partner_id=$7,
          amount_paid=$8,
          paid_at=$9,
          expense_date=$10,
          staff_id=$11
      WHERE id=$12 AND restaurant_id=$13
      RETURNING *
      `,
      [
        amountNum,
        category,
        description || null,
        paymentMode,
        vendorId || null,
        is_paid,
        partnerId || null,
        amountPaid,
        paidAt,
        expenseDate,
        staff_id || null,
        id,
        restaurantId
      ]
    );

    await client.query("COMMIT");

    res.json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    req.log?.error(err, "Expense update failed");
    next(err);
  } finally {
    client.release();
  }
});


/* =========================================
   DELETE EXPENSE
========================================= */
router.delete("/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM expenses
      WHERE restaurant_id=$1
      AND id=$2
      AND is_paid=FALSE
      RETURNING id
      `,
      [req.restaurantId, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "Expense not found or already paid"
      });
    }

    req.log?.info({ expenseId: id }, "Expense deleted");

    res.json({ message: "Deleted" });

  } catch (err) {
    req.log?.error(err, "Expense delete failed");
    next(err);
  }
});

router.post(
  "/upload",
  authenticate,
  uploadSingle,
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new Error("No file uploaded");
      }

      // 🔒 MIME TYPE CHECK
      if (!req.file.mimetype.startsWith("image/")) {
        throw new Error("Only image files allowed");
      }

      // 🔒 SIZE CHECK (example: 5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        throw new Error("File too large");
      }

      const fileUrl = req.file.location;

      req.log?.info(
        { file: fileUrl, userId: req.userId },
        "File uploaded"
      );

      res.json({ url: fileUrl });

    } catch (err) {
      next(err);
    }
  }
);

/* =========================================
   SCAN BILL WITH AI
========================================= */
router.post(
  "/scan-bill",
  authenticate,
  uploadSingle,
  async (req, res, next) => {
    try {
      if (!req.file) throw new Error("No file uploaded");

      if (!req.file.mimetype.startsWith("image/")) {
        throw new Error("Only image files are supported for scanning");
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("AI service not configured");

      const rawData = req.file.buffer ?? fs.readFileSync(req.file.path);
      const base64 = rawData.toString("base64");
      const mediaType = req.file.mimetype;

      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mediaType};base64,${base64}` },
              },
              {
                type: "text",
                text: `Extract expense details from this bill or receipt image.
Return ONLY a JSON object with these fields (no explanation, no markdown):
{
  "vendor_name": <business/stall/shop name from the bill header, or null>,
  "items": [{ "name": <item name>, "qty": <number or null>, "unit_price": <number or null>, "total": <number or null> }],
  "total_amount": <final total due as a number, or null>,
  "date": <"YYYY-MM-DD" string or null>,
  "category": <one of "supplies","utility","miscellaneous" or null>
}
"items" must always be an array (empty array if no line items found).
If the image is not a bill/receipt, return all nulls and empty items array.`,
              },
            ],
          },
        ],
      });

      const text = response.choices[0]?.message?.content || "";
      const match = text.match(/\{[\s\S]*\}/);

      let extracted = {
        vendor_name: null,
        items: [],
        total_amount: null,
        date: null,
        category: null,
      };

      if (match) {
        try {
          extracted = { ...extracted, ...JSON.parse(match[0]) };
        } catch {
          // best effort — return whatever we parsed
        }
      }

      /* ── fuzzy-match vendor name against this restaurant's vendors ── */
      let vendor_id = null;
      if (extracted.vendor_name) {
        const vendorRes = await pool.query(
          `SELECT id, name FROM vendors
           WHERE restaurant_id = $1
             AND LOWER(name) LIKE LOWER($2)
           LIMIT 1`,
          [req.restaurantId, `%${extracted.vendor_name.split(/\s+/).join("%")}%`]
        );
        if (!vendorRes.rows.length) {
          // try reverse: check if any stored vendor name is contained in extracted name
          const allVendors = await pool.query(
            `SELECT id, name FROM vendors WHERE restaurant_id = $1`,
            [req.restaurantId]
          );
          const lower = extracted.vendor_name.toLowerCase();
          const hit = allVendors.rows.find(v => lower.includes(v.name.toLowerCase()));
          if (hit) vendor_id = hit.id;
        } else {
          vendor_id = vendorRes.rows[0].id;
        }
      }

      const fileUrl = req.file.location;

      res.json({ ...extracted, vendor_id, document_url: fileUrl });

    } catch (err) {
      next(err);
    }
  }
);

export default router;