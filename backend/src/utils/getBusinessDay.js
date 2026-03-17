export async function getBusinessDay(client, restaurantId, settings, userId) {

  const useBusinessDay = settings?.use_business_day ?? false;

  const today = new Date().toISOString().slice(0,10);

  /* =========================
     BUSINESS DAY ENABLED
  ========================= */
  if (useBusinessDay) {

    const res = await client.query(
      `SELECT id
       FROM business_days
       WHERE restaurant_id=$1 AND is_closed=false
       ORDER BY id DESC
       LIMIT 1`,
      [restaurantId]
    );

    // ✅ If exists → return
    if (res.rows.length) {
      return res.rows[0].id;
    }

    // 🔥 AUTO CREATE (THIS IS THE FIX)
    const insert = await client.query(
      `INSERT INTO business_days (restaurant_id, date, opening_cash, opened_by)
       VALUES ($1, $2, 0, $3)
       RETURNING id`,
      [restaurantId, today, userId || null]
    );

    return insert.rows[0].id;
  }

  /* =========================
     BUSINESS DAY DISABLED
  ========================= */
  const insert = await client.query(
    `INSERT INTO business_days (restaurant_id,date,opening_cash)
     VALUES ($1,$2,0)
     ON CONFLICT (restaurant_id,date)
     DO NOTHING
     RETURNING id`,
    [restaurantId, today]
  );

  if (insert.rows.length) {
    return insert.rows[0].id;
  }

  const existing = await client.query(
    `SELECT id
     FROM business_days
     WHERE restaurant_id=$1 AND date=$2`,
    [restaurantId, today]
  );

  return existing.rows[0].id;
}