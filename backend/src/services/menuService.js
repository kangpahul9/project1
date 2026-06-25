import pool from "../config/db.js";

export const getAllMenu = async (restaurantId) => {
  if (!restaurantId) throw new Error("Restaurant required");

  const result = await pool.query(
    `SELECT id, name, price
     FROM menu
     WHERE restaurant_id=$1 AND is_active=TRUE
     ORDER BY id`,
    [restaurantId]
  );

  return result.rows;
};

export const addMenuItem = async (restaurantId, name, price) => {
  if (!restaurantId || !name || isNaN(Number(price))) {
    throw new Error("Invalid menu data");
  }

  const result = await pool.query(
    `INSERT INTO menu (restaurant_id, name, price)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [restaurantId, name.trim(), Number(price)]
  );

  return result.rows[0];
};