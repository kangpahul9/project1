import { closeBusinessDay, getDaySummary } from "../../src/services/businessDayService.js";

jest.mock("../../src/utils/ledger.js");
const { logEvent } = require("../../src/utils/ledger.js");

// Build a mock client from an ordered list of responses
function makeClient(...responses) {
  const fn = jest.fn();
  responses.forEach(r => fn.mockResolvedValueOnce(r));
  fn.mockResolvedValue({ rows: [] });
  return { query: fn };
}

const OPEN_DAY = { id: 1, restaurant_id: 1 };
const DENOMS   = [{ note_value: "100", quantity: "5" }]; // 500 total
const BREAKDOWN_MATCH = [{ note: 100, qty: 5 }];         // matches system

beforeEach(() => logEvent.mockReset());

// ────────────────────────────────────────────────────────────────────────────────
// closeBusinessDay
// ────────────────────────────────────────────────────────────────────────────────

describe("closeBusinessDay — happy path (no discrepancy)", () => {
  test("closes the day and returns summary when cash matches", async () => {
    const client = makeClient(
      { rows: [OPEN_DAY] },                       // SELECT open day
      { rows: DENOMS },                            // SELECT denominations
      { rows: [{ total: "500" }] },                // ledger SUM
      { rows: [] }                                 // UPDATE business_days
    );

    const result = await closeBusinessDay({
      client,
      restaurantId: 1,
      userId: 1,
      breakdown: BREAKDOWN_MATCH,
      total: 500,
      reason: "",
    });

    expect(result.businessDayId).toBe(1);
    expect(result.difference).toBe(0);
    expect(result.hasDiscrepancy).toBe(false);
    expect(logEvent).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE business_days"),
      expect.any(Array)
    );
  });
});

describe("closeBusinessDay — discrepancy with reason", () => {
  test("logs closing_adjustment event and marks hasDiscrepancy", async () => {
    const client = makeClient(
      { rows: [OPEN_DAY] },
      { rows: DENOMS },
      { rows: [{ total: "600" }] },  // system expects 600, counted 500
      { rows: [] }                    // UPDATE
    );
    logEvent.mockResolvedValue(undefined);

    const result = await closeBusinessDay({
      client,
      restaurantId: 1,
      userId: 1,
      breakdown: BREAKDOWN_MATCH,
      total: 500,
      reason: "Some cash removed for expenses",
    });

    expect(result.difference).toBe(-100);
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.expectedCash).toBe(600);
    expect(logEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ eventType: "closing_adjustment", amount: -100 })
    );
  });
});

describe("closeBusinessDay — error paths", () => {
  test("throws when breakdown is not an array", async () => {
    const client = makeClient();
    await expect(
      closeBusinessDay({ client, restaurantId: 1, userId: 1, breakdown: "bad", total: 500 })
    ).rejects.toThrow("Invalid closing data");
  });

  test("throws when total is NaN", async () => {
    const client = makeClient();
    await expect(
      closeBusinessDay({ client, restaurantId: 1, userId: 1, breakdown: [], total: NaN })
    ).rejects.toThrow("Invalid closing data");
  });

  test("throws when no open business day exists", async () => {
    const client = makeClient({ rows: [] }); // empty rows from SELECT
    await expect(
      closeBusinessDay({ client, restaurantId: 1, userId: 1, breakdown: BREAKDOWN_MATCH, total: 500 })
    ).rejects.toThrow("No open business day");
  });

  test("throws when system denomination count doesn't match counted", async () => {
    const client = makeClient(
      { rows: [OPEN_DAY] },
      { rows: DENOMS }, // system: 100×5
    );
    await expect(
      closeBusinessDay({
        client, restaurantId: 1, userId: 1,
        breakdown: [{ note: 100, qty: 3 }], // counted 3, system has 5
        total: 300,
      })
    ).rejects.toThrow("Denomination mismatch for ₹100");
  });

  test("throws when an unexpected denomination is present in counted", async () => {
    const client = makeClient(
      { rows: [OPEN_DAY] },
      { rows: DENOMS }, // system only has ₹100
    );
    await expect(
      closeBusinessDay({
        client, restaurantId: 1, userId: 1,
        breakdown: [{ note: 100, qty: 5 }, { note: 500, qty: 2 }], // ₹500 not in system
        total: 1500,
      })
    ).rejects.toThrow("Unexpected denomination ₹500");
  });

  test("throws when discrepancy exists but no reason is given", async () => {
    const client = makeClient(
      { rows: [OPEN_DAY] },
      { rows: DENOMS },
      { rows: [{ total: "700" }] }, // system 700, counted 500
    );
    await expect(
      closeBusinessDay({
        client, restaurantId: 1, userId: 1,
        breakdown: BREAKDOWN_MATCH,
        total: 500,
        reason: "",
      })
    ).rejects.toThrow("Closing reason required");
  });

  test("throws when reason is only whitespace", async () => {
    const client = makeClient(
      { rows: [OPEN_DAY] },
      { rows: DENOMS },
      { rows: [{ total: "700" }] },
    );
    await expect(
      closeBusinessDay({
        client, restaurantId: 1, userId: 1,
        breakdown: BREAKDOWN_MATCH,
        total: 500,
        reason: "   ",
      })
    ).rejects.toThrow("Closing reason required");
  });

  test("throws when breakdown denomination has invalid (negative) qty", async () => {
    const client = makeClient(
      { rows: [OPEN_DAY] },
      { rows: DENOMS },
    );
    await expect(
      closeBusinessDay({
        client, restaurantId: 1, userId: 1,
        breakdown: [{ note: 100, qty: -1 }],
        total: -100,
      })
    ).rejects.toThrow("Invalid denomination values");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// getDaySummary
// ────────────────────────────────────────────────────────────────────────────────

describe("getDaySummary", () => {
  test("returns cashSales, upiSales, and expenses totals", async () => {
    const client = makeClient(
      { rows: [{ total: "3500" }] }, // cash sales
      { rows: [{ total: "800" }] },  // upi sales
      { rows: [{ total: "200" }] }   // expenses
    );

    const summary = await getDaySummary(client, 1, 10);
    expect(summary.cashSales).toBe(3500);
    expect(summary.upiSales).toBe(800);
    expect(summary.expenses).toBe(200);
  });

  test("returns zeros when no data exists", async () => {
    const client = makeClient(
      { rows: [{ total: "0" }] },
      { rows: [{ total: "0" }] },
      { rows: [{ total: "0" }] }
    );

    const summary = await getDaySummary(client, 1, 10);
    expect(summary.cashSales).toBe(0);
    expect(summary.upiSales).toBe(0);
    expect(summary.expenses).toBe(0);
  });
});
