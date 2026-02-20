import pool from "../config/db.js";

export const findUserByPin = async (pin) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE pin = $1",
    [pin]
  );
  return result.rows[0];
};
