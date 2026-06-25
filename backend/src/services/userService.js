import db from "../config/db.js";

export async function findUserByEmail(restaurantUid, email) {
  if (!restaurantUid || !email) return null;

  const result = await db.query(
    `
    SELECT u.*
    FROM users u
    JOIN restaurants r ON r.id = u.restaurant_id
    WHERE r.restaurant_uid = $1
    AND u.email = $2
    LIMIT 1
    `,
    [restaurantUid, email]
  );

  return result.rows[0] || null;
}