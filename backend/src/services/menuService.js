import pool from "../config/db.js";

export const getAllMenu = async () => {
  const result = await pool.query(
    "SELECT id, name, price FROM menu WHERE is_active = TRUE ORDER BY id"
  );
  return result.rows;
};

export const addMenuItem = async (name, price) => {
  const result = await pool.query(
    "INSERT INTO menu (name, price) VALUES ($1, $2) RETURNING *",
    [name, price]
  );
  return result.rows[0];
};
