import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =========================================
   GET ALL CATEGORIES
========================================= */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, color, sort_order, is_active
      FROM menu_categories
      WHERE restaurant_id=$1 
      AND is_active = TRUE
      ORDER BY sort_order ASC, name ASC
      `,
      [req.restaurantId]
    );

    res.json(result.rows);

  } catch (err) {
    req.log?.error(err, "Fetch categories failed");
    next(err);
  }
});

/* =========================================
   CREATE CATEGORY
========================================= */
router.post("/", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    let { name, color, sort_order, idempotencyKey } = req.body;

    name = name?.trim();

    if (!name) {
      throw new Error("Name required");
    }

    if (!idempotencyKey) {
      throw new Error("Idempotency key required");
    }

    const safeColor = color || "#6366F1";
    const safeOrder = Math.max(0, Number(sort_order) || 0);

    await client.query("BEGIN");

    /* 🔒 idempotency */
    const existing = await client.query(
      `
      SELECT id FROM menu_categories
      WHERE restaurant_id=$1 AND idempotency_key=$2
      `,
      [req.restaurantId, idempotencyKey]
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.json({ message: "Already processed" });
    }

    /* 🔒 duplicate name protection */
    const duplicate = await client.query(
      `
      SELECT id FROM menu_categories
      WHERE restaurant_id=$1 AND LOWER(name)=LOWER($2)
      `,
      [req.restaurantId, name]
    );

    if (duplicate.rows.length) {
      throw new Error("Category already exists");
    }

    const result = await client.query(
      `
      INSERT INTO menu_categories
      (restaurant_id, name, color, sort_order, idempotency_key)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [
        req.restaurantId,
        name,
        safeColor,
        safeOrder,
        idempotencyKey
      ]
    );

    await client.query("COMMIT");

    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(400).json({ message: "Category already exists" });
    }

    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   UPDATE CATEGORY (SAFE PATCH)
========================================= */
router.put("/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    let { name, color, sort_order, is_active } = req.body;

    const existingRes = await pool.query(
      `
      SELECT *
      FROM menu_categories
      WHERE id=$1 AND restaurant_id=$2
      `,
      [id, req.restaurantId]
    );

    if (!existingRes.rows.length) {
      return res.status(404).json({ message: "Category not found" });
    }

    const existing = existingRes.rows[0];

    const updatedName = name ? name.trim() : existing.name;
    const updatedColor = color ?? existing.color;
    const updatedOrder =
      sort_order !== undefined
        ? Math.max(0, Number(sort_order))
        : existing.sort_order;

    if (!updatedName) {
      throw new Error("Name required");
    }

    /* 🔒 duplicate check (exclude self) */
    const duplicate = await pool.query(
      `
      SELECT id FROM menu_categories
      WHERE restaurant_id=$1 
      AND LOWER(name)=LOWER($2)
      AND id != $3
      `,
      [req.restaurantId, updatedName, id]
    );

    if (duplicate.rows.length) {
      throw new Error("Category name already exists");
    }

    const result = await pool.query(
      `
      UPDATE menu_categories
      SET name=$1,
          color=$2,
          sort_order=$3,
          is_active=$4
      WHERE restaurant_id=$5 AND id=$6
      RETURNING *
      `,
      [
        updatedName,
        updatedColor,
        updatedOrder,
        is_active ?? existing.is_active,
        req.restaurantId,
        id
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    next(err);
  }
});

/* =========================================
   DISABLE CATEGORY
========================================= */
router.delete("/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE menu_categories
      SET is_active = FALSE
      WHERE restaurant_id=$1 AND id=$2
      RETURNING id
      `,
      [req.restaurantId, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ message: "Category disabled" });

  } catch (err) {
    next(err);
  }
});

export default router;