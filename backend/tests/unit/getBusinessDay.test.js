import { getBusinessDay } from "../../src/utils/getBusinessDay.js";

// getBusinessDay(client, restaurantId, settings, userId) — pure function, no pool needed

function makeClient(...responses) {
  const fn = jest.fn();
  responses.forEach(r => fn.mockResolvedValueOnce(r));
  fn.mockResolvedValue({ rows: [] });
  return { query: fn };
}

const SETTINGS_BD_ON  = { use_business_day: true };
const SETTINGS_BD_OFF = { use_business_day: false };

// ────────────────────────────────────────────────────────────────────────────────
// use_business_day = true
// ────────────────────────────────────────────────────────────────────────────────

describe("getBusinessDay — use_business_day enabled", () => {
  test("returns existing open business day id", async () => {
    const client = makeClient({ rows: [{ id: 5 }] }); // SELECT finds open day
    const id = await getBusinessDay(client, 1, SETTINGS_BD_ON, 1);
    expect(id).toBe(5);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  test("inserts a new business day when none is open and returns its id", async () => {
    const client = makeClient(
      { rows: [] },          // SELECT — no open day
      { rows: [{ id: 7 }] } // INSERT — new day
    );
    const id = await getBusinessDay(client, 1, SETTINGS_BD_ON, 1);
    expect(id).toBe(7);
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  test("falls back to SELECT when INSERT throws unique-constraint error (race condition)", async () => {
    const raceError = Object.assign(new Error("unique violation"), { code: "23505" });
    const client = makeClient(
      { rows: [] },           // SELECT — no open day
    );
    client.query
      .mockRejectedValueOnce(raceError)  // INSERT fails (race)
      .mockResolvedValueOnce({ rows: [{ id: 9 }] }); // fallback SELECT

    const id = await getBusinessDay(client, 1, SETTINGS_BD_ON, 1);
    expect(id).toBe(9);
  });

  test("re-throws non-unique INSERT errors", async () => {
    const dbError = new Error("DB connection lost");
    const client = makeClient({ rows: [] });
    client.query.mockRejectedValueOnce(dbError);

    await expect(getBusinessDay(client, 1, SETTINGS_BD_ON, 1)).rejects.toThrow(
      "DB connection lost"
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// use_business_day = false
// ────────────────────────────────────────────────────────────────────────────────

describe("getBusinessDay — use_business_day disabled", () => {
  test("returns id when ON CONFLICT DO NOTHING inserts a new row", async () => {
    const client = makeClient(
      { rows: [{ id: 11 }] } // INSERT RETURNING — new row
    );
    const id = await getBusinessDay(client, 1, SETTINGS_BD_OFF, null);
    expect(id).toBe(11);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  test("falls back to SELECT when INSERT returns empty (row already exists)", async () => {
    const client = makeClient(
      { rows: [] },           // INSERT DO NOTHING — returns no rows
      { rows: [{ id: 12 }] } // SELECT existing
    );
    const id = await getBusinessDay(client, 1, SETTINGS_BD_OFF, null);
    expect(id).toBe(12);
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  test("defaults use_business_day to false when settings is null", async () => {
    const client = makeClient(
      { rows: [{ id: 13 }] }
    );
    const id = await getBusinessDay(client, 1, null, null);
    expect(id).toBe(13);
  });
});
