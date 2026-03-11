import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ==============================
   GET MENU
============================== */
router.get("/", authenticate, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
  m.id,
  m.name,
  m.price,
  m.category_id,
  m.usage_count,
  c.name as category_name,
  c.color as category_color
FROM menu m
LEFT JOIN menu_categories c
ON m.category_id = c.id
WHERE m.is_active = TRUE
ORDER BY m.name
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch menu" });
  }
});


/* ==============================
   CREATE MENU ITEM
============================== */
router.post("/", authenticate, requireAdmin, async (req, res) => {

  const { name, price, category_id } = req.body;

  if (!name || !price) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  try {

    const result = await pool.query(
      `
      INSERT INTO menu (name, price, category_id)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [name, price, category_id || null]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create menu item" });
  }

});


/* ==============================
   UPDATE MENU ITEM
============================== */
router.put("/:id", authenticate, requireAdmin, async (req, res) => {

  const { id } = req.params;
  const { name, price, category_id, is_active } = req.body;

  try {

    const result = await pool.query(
      `
      UPDATE menu
      SET name=$1,
          price=$2,
          category_id=$3,
          is_active=$4
      WHERE id=$5
      RETURNING *
      `,
      [name, price, category_id, is_active, id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update menu item" });
  }

});


/* ==============================
   DISABLE MENU ITEM
============================== */
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {

  const { id } = req.params;

  try {

    await pool.query(
      `
      UPDATE menu
      SET is_active = FALSE
      WHERE id = $1
      `,
      [id]
    );

    res.json({ message: "Menu item disabled" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to disable item" });
  }

});

export default router;