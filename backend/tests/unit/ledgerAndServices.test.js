/**
 * Unit tests for small, pure-ish utilities and services:
 *  - utils/ledger.js      (logEvent)
 *  - services/menuService (getAllMenu, addMenuItem)
 *  - services/userService (findUserByEmail)
 */

jest.mock("../../src/config/db.js");

const pool = require("../../src/config/db.js").default;

import { logEvent } from "../../src/utils/ledger.js";
import { getAllMenu, addMenuItem } from "../../src/services/menuService.js";
import { findUserByEmail } from "../../src/services/userService.js";

beforeEach(() => pool.query.mockReset());

// ────────────────────────────────────────────────────────────────────────────────
// logEvent
// ────────────────────────────────────────────────────────────────────────────────

describe("logEvent", () => {
  test("inserts a ledger event with all required fields", async () => {
    const mockClient = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };

    await logEvent(mockClient, {
      restaurantId: 1,
      businessDayId: 10,
      entityType: "cash",
      entityId: "order-5",
      eventType: "cash_sale",
      amount: 500,
      metadata: { note: "test" },
      userId: 1,
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO ledger_events"),
      [1, 10, "cash", "order-5", "cash_sale", 500, { note: "test" }, 1]
    );
  });

  test("uses empty object as default metadata", async () => {
    const mockClient = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };

    await logEvent(mockClient, {
      restaurantId: 1, businessDayId: 10, entityType: "cash",
      entityId: "x", eventType: "test", amount: 0, userId: null,
    });

    const args = mockClient.query.mock.calls[0][1];
    expect(args[6]).toEqual({}); // metadata defaults to {}
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// menuService — getAllMenu
// ────────────────────────────────────────────────────────────────────────────────

describe("getAllMenu", () => {
  test("returns menu items for a restaurant", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Burger", price: "150" }],
    });
    const items = await getAllMenu(1);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Burger");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE restaurant_id=$1"),
      [1]
    );
  });

  test("throws when restaurantId is missing", async () => {
    await expect(getAllMenu(null)).rejects.toThrow("Restaurant required");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("returns empty array when no active items", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const items = await getAllMenu(1);
    expect(items).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// menuService — addMenuItem
// ────────────────────────────────────────────────────────────────────────────────

describe("addMenuItem", () => {
  test("inserts and returns the new menu item", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 5, name: "Pizza", price: "250", restaurant_id: 1 }],
    });
    const item = await addMenuItem(1, "Pizza", 250);
    expect(item.name).toBe("Pizza");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO menu"),
      [1, "Pizza", 250]
    );
  });

  test("trims whitespace from name before inserting", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 6, name: "Wrap" }] });
    await addMenuItem(1, "  Wrap  ", 120);
    const args = pool.query.mock.calls[0][1];
    expect(args[1]).toBe("Wrap");
  });

  test("throws when restaurantId is missing", async () => {
    await expect(addMenuItem(null, "Burger", 100)).rejects.toThrow("Invalid menu data");
  });

  test("throws when name is empty", async () => {
    await expect(addMenuItem(1, "", 100)).rejects.toThrow("Invalid menu data");
  });

  test("throws when price is not a number", async () => {
    await expect(addMenuItem(1, "Fries", "expensive")).rejects.toThrow("Invalid menu data");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// userService — findUserByEmail
// ────────────────────────────────────────────────────────────────────────────────

describe("findUserByEmail", () => {
  test("returns user when found by restaurant UID and email", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: "admin@test.com", role: "ADMIN" }],
    });
    const user = await findUserByEmail("uid-abc", "admin@test.com");
    expect(user.id).toBe(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("restaurant_uid"),
      ["uid-abc", "admin@test.com"]
    );
  });

  test("returns null when user not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const user = await findUserByEmail("uid-abc", "nobody@test.com");
    expect(user).toBeNull();
  });

  test("returns null immediately when restaurantUid is missing", async () => {
    const user = await findUserByEmail(null, "admin@test.com");
    expect(user).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("returns null immediately when email is missing", async () => {
    const user = await findUserByEmail("uid-abc", null);
    expect(user).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });
});
