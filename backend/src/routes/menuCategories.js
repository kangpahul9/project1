import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT *
      FROM menu_categories
      WHERE restaurant_id=$1 AND is_active = TRUE
      ORDER BY sort_order
    `,[req.restaurantId]);

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
    const order = Math.max(0, sort_order || 0);

    const result = await pool.query(
      `
      INSERT INTO menu_categories (restaurant_id,name, color, sort_order)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [
        req.restaurantId,
        name,
        color || "#6366F1",
        order
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {

  if (err.code === "23505") {
    return res.status(400).json({ message: "Category already exists" });
  }

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
      WHERE restaurant_id=$5 AND id=$6
      RETURNING *
      `,
      [name, color, sort_order, is_active,req.restaurantId, id]
    );

    if (result.rows.length === 0) {
  return res.status(404).json({ message: "Category not found" });
}
res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update category" });
  }

});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {

  const { id } = req.params;

  try {

   const result = await pool.query(
`
UPDATE menu_categories
SET is_active = FALSE
WHERE restaurant_id=$1 AND id=$2
RETURNING id
`,
[req.restaurantId, id]
);

if (result.rowCount === 0) {
  return res.status(404).json({ message: "Category not found" });
}

res.json({ message: "Category disabled" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to disable category" });
  }

});

export default router;
