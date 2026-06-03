export async function getTodaySales(db, restaurantId) {
  const res = await db.query(
    `SELECT COALESCE(SUM(total),0) AS total
     FROM orders
     WHERE restaurant_id = $1
       AND DATE(created_at) = CURRENT_DATE`,
    [restaurantId]
  );

  return { todaySales: Number(res.rows[0].total) };
}

export async function getOrdersCount(db, restaurantId) {
  const res = await db.query(
    `SELECT COUNT(*) AS count
     FROM orders
     WHERE restaurant_id = $1
       AND DATE(created_at) = CURRENT_DATE`,
    [restaurantId]
  );

  return { orders: Number(res.rows[0].count) };
}

export async function getTopItems(db, restaurantId) {
  const res = await db.query(
    `
    SELECT oi.item_name, SUM(oi.quantity) as qty
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.restaurant_id = $1
      AND DATE(o.created_at) = CURRENT_DATE
    GROUP BY oi.item_name
    ORDER BY qty DESC
    LIMIT 5
    `,
    [restaurantId]
  );

  return { topItems: res.rows };
}

export async function getExpensesSummary(db, restaurantId) {
  const res = await db.query(
    `
    SELECT COALESCE(SUM(amount),0) AS total
    FROM expenses
    WHERE restaurant_id = $1
      AND DATE(created_at) = CURRENT_DATE
    `,
    [restaurantId]
  );

  return { expenses: Number(res.rows[0].total) };
}

export async function getItemSalesRange(
  db,
  restaurantId,
  { item, startDate, endDate }
) {
  const res = await db.query(
    `
    SELECT COALESCE(SUM(oi.quantity),0) AS total
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.restaurant_id = $1
      AND LOWER(oi.item_name) = LOWER($2)
      AND o.created_at BETWEEN $3 AND $4
    `,
    [restaurantId, item, startDate, endDate]
  );

  return {
    item,
    startDate,
    endDate,
    totalSold: Number(res.rows[0].total),
  };
}