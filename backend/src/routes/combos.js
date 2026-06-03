import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ─────────────────────────────────────────
   GET /combos  — all active combos with items + tiers
───────────────────────────────────────── */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const combosRes = await pool.query(
      `SELECT id, name, combo_type, bundle_price
       FROM combos
       WHERE restaurant_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC`,
      [req.restaurantId]
    );

    if (!combosRes.rows.length) return res.json([]);

    const comboIds = combosRes.rows.map((r) => r.id);

    const [itemsRes, tiersRes] = await Promise.all([
      pool.query(
        `SELECT ci.id, ci.combo_id, ci.menu_item_id, ci.quantity,
                m.name AS menu_item_name, m.price AS item_price
         FROM combo_items ci
         JOIN menu m ON m.id = ci.menu_item_id
         WHERE ci.combo_id = ANY($1)
         ORDER BY ci.id ASC`,
        [comboIds]
      ),
      pool.query(
        `SELECT * FROM combo_tiers WHERE combo_id = ANY($1) ORDER BY combo_id, quantity ASC`,
        [comboIds]
      ),
    ]);

    const itemsByCombo = {};
    for (const row of itemsRes.rows) {
      if (!itemsByCombo[row.combo_id]) itemsByCombo[row.combo_id] = [];
      itemsByCombo[row.combo_id].push({
        id: row.id,
        menu_item_id: row.menu_item_id,
        menu_item_name: row.menu_item_name,
        item_price: Number(row.item_price),
        quantity: Number(row.quantity),
      });
    }

    const tiersByCombo = {};
    for (const row of tiersRes.rows) {
      if (!tiersByCombo[row.combo_id]) tiersByCombo[row.combo_id] = [];
      tiersByCombo[row.combo_id].push({
        id: row.id,
        quantity: Number(row.quantity),
        price: Number(row.price),
      });
    }

    const result = combosRes.rows.map((c) => ({
      ...c,
      bundle_price: c.bundle_price ? Number(c.bundle_price) : null,
      items: itemsByCombo[c.id] || [],
      tiers: tiersByCombo[c.id] || [],
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────
   POST /combos  — create combo
   Body (volume): { name, combo_type:'volume', items:[{menu_item_id,quantity}], tiers:[{quantity,price}] }
   Body (bundle): { name, combo_type:'bundle', bundle_price, items:[{menu_item_id,quantity}] }
───────────────────────────────────────── */
router.post("/", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, combo_type = "volume", bundle_price, items = [], tiers = [] } = req.body;

    if (!name?.trim()) throw new Error("Name is required");
    if (!items.length) throw new Error("At least one item is required");

    if (tiers.length) {
      for (const t of tiers) {
        if (!t.quantity || t.quantity < 1) throw new Error("Tier quantity must be ≥ 1");
        if (!t.price || t.price <= 0) throw new Error("Tier price must be > 0");
      }
    }
    if (combo_type === "volume" && !tiers.length) throw new Error("Volume combos need at least one pricing tier");
    if (combo_type === "bundle" && !tiers.length && (!bundle_price || bundle_price <= 0)) {
      throw new Error("Bundle combo needs either a flat price or quantity tiers");
    }

    // Verify all items belong to this restaurant
    const menuIds = items.map((i) => i.menu_item_id);
    const check = await pool.query(
      `SELECT id FROM menu WHERE id = ANY($1) AND restaurant_id = $2 AND is_active = TRUE`,
      [menuIds, req.restaurantId]
    );
    if (check.rows.length !== menuIds.length) throw new Error("One or more menu items not found");

    await client.query("BEGIN");

    const comboRes = await client.query(
      `INSERT INTO combos (restaurant_id, name, combo_type, bundle_price)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [req.restaurantId, name.trim(), combo_type, bundle_price || null]
    );
    const comboId = comboRes.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES ($1,$2,$3)`,
        [comboId, item.menu_item_id, item.quantity || 1]
      );
    }

    for (let i = 0; i < tiers.length; i++) {
      await client.query(
        `INSERT INTO combo_tiers (combo_id, quantity, price, sort_order) VALUES ($1,$2,$3,$4)`,
        [comboId, tiers[i].quantity, tiers[i].price, i]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ id: comboId });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────
   PUT /combos/:id  — update (replaces items + tiers)
───────────────────────────────────────── */
router.put("/:id", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, combo_type = "volume", bundle_price, items = [], tiers = [] } = req.body;
    const { id } = req.params;

    if (!name?.trim()) throw new Error("Name is required");
    if (!items.length) throw new Error("At least one item is required");

    const existing = await pool.query(
      `SELECT id FROM combos WHERE id = $1 AND restaurant_id = $2`,
      [id, req.restaurantId]
    );
    if (!existing.rows.length) return res.status(404).json({ error: "Combo not found" });

    const menuIds = items.map((i) => i.menu_item_id);
    const check = await pool.query(
      `SELECT id FROM menu WHERE id = ANY($1) AND restaurant_id = $2 AND is_active = TRUE`,
      [menuIds, req.restaurantId]
    );
    if (check.rows.length !== menuIds.length) throw new Error("One or more menu items not found");

    await client.query("BEGIN");

    await client.query(
      `UPDATE combos SET name=$1, combo_type=$2, bundle_price=$3 WHERE id=$4`,
      [name.trim(), combo_type, bundle_price || null, id]
    );

    await client.query(`DELETE FROM combo_items WHERE combo_id = $1`, [id]);
    for (const item of items) {
      await client.query(
        `INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES ($1,$2,$3)`,
        [id, item.menu_item_id, item.quantity || 1]
      );
    }

    await client.query(`DELETE FROM combo_tiers WHERE combo_id = $1`, [id]);
    for (let i = 0; i < tiers.length; i++) {
      await client.query(
        `INSERT INTO combo_tiers (combo_id, quantity, price, sort_order) VALUES ($1,$2,$3,$4)`,
        [id, tiers[i].quantity, tiers[i].price, i]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* ─────────────────────────────────────────
   DELETE /combos/:id  — soft disable
───────────────────────────────────────── */
router.delete("/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE combos SET is_active = FALSE WHERE id = $1 AND restaurant_id = $2`,
      [req.params.id, req.restaurantId]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Combo not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
