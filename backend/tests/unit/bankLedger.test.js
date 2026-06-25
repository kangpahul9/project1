import { addBankTransaction } from "../../src/utils/bankLedger.js";

jest.mock("../../src/utils/ledger.js", () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

const makeClient = (accountRows = [], extraRows = []) => {
  const responses = [
    { rows: accountRows },   // SELECT balance FOR UPDATE
    { rows: [] },            // INSERT bank_transaction
    { rows: [] },            // UPDATE bank_accounts balance
    ...extraRows,
  ];
  let i = 0;
  return {
    query: jest.fn(() => Promise.resolve(responses[i++] ?? { rows: [] })),
  };
};

describe("addBankTransaction", () => {
  const base = {
    restaurantId: 1,
    bankAccountId: 5,
    amount: 500,
    type: "credit",
    source: "cash_sale",
    referenceId: 99,
    description: "Test",
    partnerId: null,
    createdBy: 1,
    idempotencyKey: null,
  };

  test("credit increases balance and returns new balance", async () => {
    const client = makeClient([{ balance: 1000 }]);
    const result = await addBankTransaction(client, { ...base, type: "credit", amount: 500 });
    expect(result).toBe(1500);

    const updateCall = client.query.mock.calls[2];
    expect(updateCall[1][0]).toBe(1500); // new balance passed to UPDATE
  });

  test("debit decreases balance and returns new balance", async () => {
    const client = makeClient([{ balance: 1000 }]);
    const result = await addBankTransaction(client, { ...base, type: "debit", amount: 300 });
    expect(result).toBe(700);
  });

  test("throws when bank account not found", async () => {
    const client = makeClient([]); // empty rows
    await expect(
      addBankTransaction(client, base)
    ).rejects.toThrow("Bank account not found");
  });

  test("throws when debit would make balance negative", async () => {
    const client = makeClient([{ balance: 100 }]);
    await expect(
      addBankTransaction(client, { ...base, type: "debit", amount: 200 })
    ).rejects.toThrow("Insufficient bank balance");
  });

  test("throws for zero amount", async () => {
    const client = makeClient([{ balance: 500 }]);
    await expect(
      addBankTransaction(client, { ...base, amount: 0 })
    ).rejects.toThrow("Invalid bank transaction amount");
  });

  test("throws for negative amount", async () => {
    const client = makeClient([{ balance: 500 }]);
    await expect(
      addBankTransaction(client, { ...base, amount: -100 })
    ).rejects.toThrow("Invalid bank transaction amount");
  });

  test("throws for invalid transaction type", async () => {
    const client = makeClient([{ balance: 500 }]);
    await expect(
      addBankTransaction(client, { ...base, type: "withdraw" })
    ).rejects.toThrow("Invalid transaction type");
  });

  test("inserts transaction with correct parameters", async () => {
    const client = makeClient([{ balance: 500 }]);
    await addBankTransaction(client, base);

    const insertCall = client.query.mock.calls[1];
    const params = insertCall[1];
    expect(params[0]).toBe(base.restaurantId);
    expect(params[1]).toBe(base.bankAccountId);
    expect(params[2]).toBe(base.amount);
    expect(params[3]).toBe("credit");
    expect(params[4]).toBe(base.source);
  });

  test("exact zero balance debit succeeds (boundary)", async () => {
    const client = makeClient([{ balance: 300 }]);
    const result = await addBankTransaction(client, { ...base, type: "debit", amount: 300 });
    expect(result).toBe(0);
  });
});
