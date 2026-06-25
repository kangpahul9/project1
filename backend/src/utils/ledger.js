export async function logEvent(client, {
  restaurantId,
  businessDayId,
  entityType,
  entityId,
  eventType,
  amount,
  metadata = {},
  userId
}) {
  await client.query(
    `
    INSERT INTO ledger_events
    (restaurant_id, business_day_id, entity_type, entity_id, event_type, amount, metadata, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      restaurantId,
      businessDayId,
      entityType,
      entityId,
      eventType,
      amount,
      metadata,
      userId
    ]
  );
}