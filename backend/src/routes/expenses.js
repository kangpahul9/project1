import express from "express";
import pool from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================
   CREATE EXPENSE
========================================= */
router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      businessDayId,
      amount,
      category,
      description,
      paymentMode,
      vendorId
    } = req.body;

    if (!businessDayId || !amount || !category || !paymentMode) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO expenses
      (business_day_id, amount, category, description, payment_method, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        businessDayId,
        amount,
        category,
        description || null,
        paymentMode,
        req.user.id
      ]
    );

    await client.query("COMMIT");

    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Failed to create expense" });
  } finally {
    client.release();
  }
});


/* =========================================
   GET ALL EXPENSES
========================================= */
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.*,
        u.name AS user_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});


/* =========================================
   UPDATE EXPENSE
========================================= */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, description, paymentMode } = req.body;

    const result = await pool.query(
      `
      UPDATE expenses
      SET amount = $1,
          category = $2,
          description = $3,
          payment_method = $4
      WHERE id = $5
      RETURNING *
      `,
      [amount, category, description || null, paymentMode, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update expense" });
  }
});


/* =========================================
   DELETE EXPENSE
========================================= */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM expenses WHERE id = $1`,
      [id]
    );

    res.json({ message: "Expense deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete expense" });
  }
});

export default router;