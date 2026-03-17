export async function addBankTransaction(client, {
  restaurantId,
  bankAccountId,
  amount,
  type, // 'credit' | 'debit'
  source,
  referenceId = null,
  description = ""
}) {
  await client.query(
    `
    INSERT INTO bank_transactions (
      restaurant_id,
      bank_account_id,
      amount,
      type,
      source,
      reference_id,
      description
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      restaurantId,
      bankAccountId,
      amount,
      type,
      source,
      referenceId,
      description
    ]
  );
}