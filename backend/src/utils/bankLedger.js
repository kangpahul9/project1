import {logEvent} from "./ledger.js";

export async function addBankTransaction(
  client,
  {
    restaurantId,
    bankAccountId,
    amount,
    type,
    source,
    referenceId = null,
    description = "",
    partnerId = null,
    createdBy = null,
    idempotencyKey = null,
  }
) {
  const amt = Number(amount);

  /* =========================
     VALIDATION
  ========================= */
  if (!amt || amt <= 0) {
    throw new Error("Invalid bank transaction amount");
  }

  if (!["credit", "debit"].includes(type)) {
    throw new Error("Invalid transaction type");
  }

  /* =========================
     IDEMPOTENCY (ANTI-DUPLICATE)
  ========================= */
  // if (idempotencyKey) {
  //   const existing = await client.query(
  //     `
  //     SELECT id FROM bank_transactions
  //     WHERE idempotency_key = $1
  //     `,
  //     [idempotencyKey]
  //   );

  //   if (existing.rows.length) {
  //     return; // already processed
  //   }
  // }

  /* =========================
     LOCK ACCOUNT
  ========================= */
  const accountRes = await client.query(
    `
    SELECT balance
    FROM bank_accounts
    WHERE id = $1 AND restaurant_id = $2
    FOR UPDATE
    `,
    [bankAccountId, restaurantId]
  );

  if (!accountRes.rows.length) {
    throw new Error("Bank account not found");
  }

  const currentBalance = Number(accountRes.rows[0].balance);

  const newBalance =
    type === "credit"
      ? currentBalance + amt
      : currentBalance - amt;

  if (newBalance < 0) {
    throw new Error("Insufficient bank balance");
  }

  /* =========================
     INSERT TRANSACTION
  ========================= */
  await client.query(
    `
    INSERT INTO bank_transactions (
      restaurant_id,
      bank_account_id,
      amount,
      type,
      source,
      reference_id,
      description,
      partner_id,
      created_by,
      idempotency_key
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
      restaurantId,
      bankAccountId,
      amt,
      type,
      source,
      referenceId,
      description,
      partnerId,
      createdBy,
      idempotencyKey,
    ]
  );

  /* =========================
     UPDATE BALANCE
  ========================= */
  await client.query(
    `
    UPDATE bank_accounts
    SET balance = $1
    WHERE id = $2 AND restaurant_id = $3
    `,
    [newBalance, bankAccountId, restaurantId]
  );

  return newBalance;
}


export async function bankWithEvent(client, payload) {
  const balance = await addBankTransaction(client, payload);

  const {
    restaurantId,
    amount,
    type,
    source,
    referenceId,
    createdBy
  } = payload;

  const eventType =
    type === "credit" ? "bank_credit" : "bank_debit";

  await logEvent(client, {
    restaurantId,
    businessDayId: null, // bank not tied to day always
    entityType: "bank",
    entityId: referenceId,
    eventType,
    amount: type === "credit" ? amount : -amount,
    metadata: { source },
    userId: createdBy
  });

  return balance;
}