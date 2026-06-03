import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { uploadSingle } from "../middleware/upload.js";

const router = express.Router();

/* =========================================
   CONSTANTS
========================================= */
const MAX_MENU_ITEMS = 1000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/* =========================================
   GET ITEM BY BARCODE
========================================= */
router.get("/barcode/:barcode", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.*, c.name as category_name, c.color as category_color
       FROM menu m
       LEFT JOIN menu_categories c ON m.category_id = c.id AND c.restaurant_id = $1
       WHERE m.restaurant_id = $1 AND m.barcode = $2 AND m.is_active = TRUE
       LIMIT 1`,
      [req.restaurantId, req.params.barcode]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Item not found" });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

/* =========================================
   GET MENU
========================================= */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT
        m.id,
        m.name,
        m.price,
        m.category_id,
        m.usage_count,
        m.is_weight_based,
        m.image_url,
        m.barcode,
        c.name as category_name,
        c.color as category_color
      FROM menu m
      LEFT JOIN menu_categories c
        ON m.category_id = c.id
        AND c.restaurant_id = $1
      WHERE m.restaurant_id = $1 
      AND m.is_active = TRUE
      ORDER BY m.name
      LIMIT $2
      `,
      [req.restaurantId, MAX_MENU_ITEMS]
    );

    res.json(result.rows);

  } catch (err) {
    req.log?.error(err, "Fetch menu failed");
    next(err);
  }
});

/* =========================================
   CREATE MENU ITEM
========================================= */
router.post("/", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    let {
      name,
      price,
      category_id,
      is_weight_based,
      idempotencyKey
    } = req.body;

    name = name?.trim();
    price = Number(price);

    if (!name || !price || price <= 0) {
      throw new Error("Invalid payload");
    }

    if (!idempotencyKey) {
      throw new Error("Idempotency key required");
    }

    await client.query("BEGIN");

    /* 🔒 idempotency */
    const existing = await client.query(
      `
      SELECT id FROM menu
      WHERE restaurant_id=$1 AND idempotency_key=$2
      `,
      [req.restaurantId, idempotencyKey]
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.json({ message: "Already processed" });
    }

    /* 🔒 prevent duplicate menu names */
    const duplicate = await client.query(
      `
      SELECT id FROM menu
      WHERE restaurant_id=$1 AND LOWER(name)=LOWER($2)
      `,
      [req.restaurantId, name]
    );

    if (duplicate.rows.length) {
      throw new Error("Menu item already exists");
    }

    /* 🔒 category validation */
    if (category_id) {
      const check = await client.query(
        `SELECT id FROM menu_categories 
         WHERE id=$1 AND restaurant_id=$2`,
        [category_id, req.restaurantId]
      );

      if (!check.rows.length) {
        throw new Error("Invalid category");
      }
    }

    const result = await client.query(
      `
      INSERT INTO menu
      (restaurant_id, name, price, category_id, is_weight_based, barcode, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        req.restaurantId,
        name,
        price,
        category_id || null,
        is_weight_based ?? false,
        req.body.barcode || null,
        idempotencyKey
      ]
    );

    await client.query("COMMIT");

    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   UPDATE MENU ITEM (PATCH SAFE)
========================================= */
router.put("/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    let {
      name,
      price,
      category_id,
      is_active,
      is_weight_based
    } = req.body;

    const existingRes = await pool.query(
      `SELECT * FROM menu WHERE id=$1 AND restaurant_id=$2`,
      [id, req.restaurantId]
    );

    if (!existingRes.rows.length) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    const existing = existingRes.rows[0];

    const updatedName = name ? name.trim() : existing.name;
    const updatedPrice = price ? Number(price) : existing.price;

    if (!updatedName || !updatedPrice || updatedPrice <= 0) {
      throw new Error("Invalid payload");
    }

    if (category_id) {
      const check = await pool.query(
        `SELECT id FROM menu_categories 
         WHERE id=$1 AND restaurant_id=$2`,
        [category_id, req.restaurantId]
      );

      if (!check.rows.length) {
        throw new Error("Invalid category");
      }
    }

    const result = await pool.query(
      `
      UPDATE menu
      SET name=$1,
          price=$2,
          category_id=$3,
          is_active=$4,
          is_weight_based=$5,
          barcode=$6
      WHERE id=$7 AND restaurant_id=$8
      RETURNING *
      `,
      [
        updatedName,
        updatedPrice,
        category_id ?? existing.category_id,
        is_active ?? existing.is_active,
        is_weight_based ?? existing.is_weight_based,
        req.body.barcode !== undefined ? (req.body.barcode || null) : existing.barcode,
        id,
        req.restaurantId
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    next(err);
  }
});

/* =========================================
   UPLOAD MENU IMAGE
========================================= */
router.post(
  "/:id/image",
  authenticate,
  requireAdmin,
  uploadSingle,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        throw new Error("No file uploaded");
      }

      if (!req.file.mimetype.startsWith("image/")) {
        throw new Error("Only image files allowed");
      }

      if (req.file.size > MAX_IMAGE_SIZE) {
        throw new Error("Max file size is 5MB");
      }

      const imageUrl = req.file.location;

      const result = await pool.query(
        `
        UPDATE menu
        SET image_url = $1
        WHERE id = $2 AND restaurant_id = $3
        RETURNING id, image_url
        `,
        [imageUrl, id, req.restaurantId]
      );

      if (!result.rows.length) {
        throw new Error("Menu item not found");
      }

      req.log?.info(
        { menuId: id, imageUrl },
        "Menu image updated"
      );

      res.json(result.rows[0]);

    } catch (err) {
      next(err);
    }
  }
);

/* =========================================
   REMOVE MENU IMAGE
========================================= */
router.delete("/:id/image", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE menu SET image_url = NULL WHERE id = $1 AND restaurant_id = $2 RETURNING id`,
      [id, req.restaurantId]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Menu item not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   DISABLE MENU ITEM
========================================= */
router.delete("/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE menu
      SET is_active = FALSE
      WHERE id = $1 AND restaurant_id = $2
      `,
      [id, req.restaurantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    res.json({ message: "Menu item disabled" });

  } catch (err) {
    next(err);
  }
});

export default router;