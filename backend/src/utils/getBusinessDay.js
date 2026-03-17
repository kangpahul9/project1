export async function getBusinessDay(client, restaurantId, settings) {

  const useBusinessDay = settings?.use_business_day ?? false;

  if (useBusinessDay) {

    const res = await client.query(
      `SELECT id
       FROM business_days
       WHERE restaurant_id=$1 AND is_closed=false
       ORDER BY id DESC
       LIMIT 1`,
      [restaurantId]
    );

    if (!res.rows.length) {
      throw new Error("No open business day");
    }

    return res.rows[0].id;
  }

  const today = new Date().toISOString().slice(0,10);

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