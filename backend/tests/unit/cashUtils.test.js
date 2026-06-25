import { deductCash, addCash } from "../../src/utils/cashUtils.js";

const makeClient = (queryResponses = []) => {
  let callIndex = 0;
  return {
    query: jest.fn(() => {
      const resp = queryResponses[callIndex] ?? { rows: [] };
      callIndex++;
      return Promise.resolve(resp);
    }),
  };
};

describe("deductCash", () => {
  const restaurantId = 1;
  const businessDayId = 10;

  test("deducts valid denominations from the drawer", async () => {
    const denominations = { 500: 1, 100: 2 };
    // Pre-check queries: 500→qty5, 100→qty3; then update queries
    const client = makeClient([
      { rows: [{ quantity: 5 }] },  // check 500
      { rows: [{ quantity: 3 }] },  // check 100
      { rows: [] },                  // update 500
      { rows: [] },                  // update 100
    ]);

    await expect(
      deductCash(client, restaurantId, businessDayId, denominations)
    ).resolves.toBeUndefined();

    expect(client.query).toHaveBeenCalledTimes(4);
  });

  test("throws when denomination not found in drawer", async () => {
    const denominations = { 500: 1 };
    const client = makeClient([{ rows: [] }]); // no rows → not found

    await expect(
      deductCash(client, restaurantId, businessDayId, denominations)
    ).rejects.toThrow("Not enough notes for");
  });

  test("throws when quantity is insufficient", async () => {
    const denominations = { 500: 5 };
    const client = makeClient([{ rows: [{ quantity: 2 }] }]); // only 2 available

    await expect(
      deductCash(client, restaurantId, businessDayId, denominations)
    ).rejects.toThrow("Not enough notes for");
  });

  test("skips denominations with qty 0", async () => {
    const denominations = { 500: 0, 100: 0 };
    const client = makeClient([]);

    await deductCash(client, restaurantId, businessDayId, denominations);
    expect(client.query).not.toHaveBeenCalled();
  });

  test("validates all denominations before updating any (pre-check phase)", async () => {
    const denominations = { 500: 1, 100: 5 };
    // 500 → ok (qty 3), 100 → insufficient (qty 2 < 5)
    const client = makeClient([
      { rows: [{ quantity: 3 }] },
      { rows: [{ quantity: 2 }] },
    ]);

    await expect(
      deductCash(client, restaurantId, businessDayId, denominations)
    ).rejects.toThrow("Not enough notes for");

    // No DML UPDATE queries should have been called (FOR UPDATE in SELECT is not a DML UPDATE)
    const updateCalls = client.query.mock.calls.filter(
      ([sql]) => sql.trim().toUpperCase().startsWith("UPDATE")
    );
    expect(updateCalls).toHaveLength(0);
  });
});

describe("addCash", () => {
  const restaurantId = 1;
  const businessDayId = 10;

  test("upserts each denomination", async () => {
    const denominations = { 500: 2, 100: 3 };
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await addCash(client, restaurantId, businessDayId, denominations);
    expect(client.query).toHaveBeenCalledTimes(2);

    // JS numeric object keys iterate in ascending order: 100 before 500
    const params = client.query.mock.calls.map((c) => c[1]);
    expect(params).toEqual(
      expect.arrayContaining([
        [restaurantId, businessDayId, "500", 2],
        [restaurantId, businessDayId, "100", 3],
      ])
    );
  });

  test("skips denominations with qty 0", async () => {
    const denominations = { 500: 0, 100: 2 };
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

    await addCash(client, restaurantId, businessDayId, denominations);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  test("upsert SQL uses ON CONFLICT to add quantities", async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await addCash(client, restaurantId, businessDayId, { 100: 1 });

    const [sql] = client.query.mock.calls[0];
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("quantity = denominations.quantity +");
  });
});
