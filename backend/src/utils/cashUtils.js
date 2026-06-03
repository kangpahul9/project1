export async function deductCash(
  client,
  restaurantId,
  businessDayId,
  denominations
) {
  // 🔒 PRE-CHECK FIRST (avoid partial updates)
  for (const [value, qty] of Object.entries(denominations)) {
    const q = Number(qty);
    if (q <= 0) continue;

    const check = await client.query(
      `
      SELECT quantity
      FROM denominations
      WHERE restaurant_id=$1 
      AND business_day_id=$2 
      AND note_value=$3
      FOR UPDATE
      `,
      [restaurantId, businessDayId, value]
    );

    if (!check.rows.length || check.rows[0].quantity < q) {
      throw new Error(`Not enough notes for ₹${value}`);
    }
  }

  // 🔄 APPLY AFTER VALIDATION
  for (const [value, qty] of Object.entries(denominations)) {
    const q = Number(qty);
    if (q <= 0) continue;

    await client.query(
      `
      UPDATE denominations
      SET quantity = quantity - $1
      WHERE restaurant_id=$2 
      AND business_day_id=$3 
      AND note_value=$4
      `,
      [q, restaurantId, businessDayId, value]
    );
  }
}

export async function addCash(
  client,
  restaurantId,
  businessDayId,
  denominations
) {
  for (const [value, qty] of Object.entries(denominations)) {
    const q = Number(qty);
    if (q <= 0) continue;

    await client.query(
      `
      INSERT INTO denominations
      (restaurant_id, business_day_id, note_value, quantity)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (restaurant_id, business_day_id, note_value)
      DO UPDATE SET quantity = denominations.quantity + $4
      `,
      [restaurantId, businessDayId, value, q]
    );
  }
}