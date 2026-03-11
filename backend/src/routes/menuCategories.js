import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT *
      FROM menu_categories
      WHERE is_active = TRUE
      ORDER BY sort_order
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

router.post("/", authenticate, requireAdmin, async (req, res) => {

  const { name, color, sort_order } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name required" });
  }

  try {

    const result = await pool.query(
      `
      INSERT INTO menu_categories (name, color, sort_order)
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [
        name,
        color || "#6366F1",
        sort_order || 0
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create category" });
  }

});

router.put("/:id", authenticate, requireAdmin, async (req, res) => {

  const { id } = req.params;
  const { name, color, sort_order, is_active } = req.body;

  if (!name) {
  return res.status(400).json({ message: "Name required" });
}

  try {

    const result = await pool.query(
      `
      UPDATE menu_categories
      SET name=$1,
          color=$2,
          sort_order=$3,
          is_active=$4
      WHERE id=$5
      RETURNING *
      `,
      [name, color, sort_order, is_active, id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update category" });
  }

});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {

  const { id } = req.params;

  try {

    await pool.query(
      `
      UPDATE menu_categories
      SET is_active = FALSE
      WHERE id = $1
      `,
      [id]
    );

    res.json({ message: "Category disabled" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to disable category" });
  }

});

export default router;
