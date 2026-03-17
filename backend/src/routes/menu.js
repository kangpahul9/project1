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
  m.is_weight_based,
  c.name as category_name,
  c.color as category_color
FROM menu m
LEFT JOIN menu_categories c
ON m.category_id = c.id
AND c.restaurant_id = $1
WHERE m.restaurant_id = $1 AND m.is_active = TRUE
ORDER BY m.name
    `,[req.restaurantId]);

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

  const { name, price, category_id, is_weight_based } = req.body;

  if (!name || !price) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  if (!name || price <= 0) {
  return res.status(400).json({ message: "Invalid payload" });
}

  try {
    if (category_id) {
  const categoryCheck = await pool.query(
    `
    SELECT id
    FROM menu_categories
    WHERE id = $1 AND restaurant_id = $2
    `,
    [category_id, req.restaurantId]
  );

  if (categoryCheck.rows.length === 0) {
    return res.status(400).json({ message: "Invalid category" });
  }
}
    const result = await pool.query(
      `
      INSERT INTO menu (restaurant_id, name, price, category_id, is_weight_based)
VALUES ($1,$2,$3,$4,$5)
RETURNING *
      `,
      [req.restaurantId, name, price, category_id || null, is_weight_based || false]
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
  const { name, price, category_id, is_active, is_weight_based } = req.body;

  try {

    const result = await pool.query(
      `
     UPDATE menu
SET name=$1,
    price=$2,
    category_id=$3,
    is_active=$4,
    is_weight_based=$5 
WHERE id=$6 AND restaurant_id=$7
RETURNING *
      `,
[
  name,
  price,
  category_id,
  is_active,
  is_weight_based ?? false,
  id,
  req.restaurantId
]
    );

   if (result.rows.length === 0) {
  return res.status(404).json({ message: "Menu item not found" });
}

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

    const result = await pool.query(
`
UPDATE menu
SET is_active = FALSE
WHERE id = $1 AND restaurant_id = $2
`,
[id, req.restaurantId]
);

if (result.rowCount === 0) {
  return res.status(404).json({ message: "Menu item not found" });
}

res.json({ message: "Menu item disabled" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to disable item" });
  }

});

export default router;