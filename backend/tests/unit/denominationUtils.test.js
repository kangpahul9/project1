import {
  normalizeDenominations,
  validateDenominations,
  calculateTotal,
} from "../../src/utils/denominationUtils.js";

describe("normalizeDenominations", () => {
  test("fills all INR denominations with 0 for empty input", () => {
    const result = normalizeDenominations({}, "INR");
    expect(result).toMatchObject({
      500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0,
    });
    expect(Object.keys(result).length).toBe(9);
  });

  test("carries over provided quantities", () => {
    const result = normalizeDenominations({ 500: 3, 100: 2 }, "INR");
    expect(result[500]).toBe(3);
    expect(result[100]).toBe(2);
    expect(result[50]).toBe(0);
  });

  test("strips keys not in allowed denominations", () => {
    const result = normalizeDenominations({ 9999: 5, 500: 1 }, "INR");
    expect(result[9999]).toBeUndefined();
    expect(result[500]).toBe(1);
  });

  test("normalizes AUD denominations", () => {
    const result = normalizeDenominations({}, "AUD");
    // toHaveProperty uses dot as path separator, so check keys directly for decimals
    expect(Object.keys(result)).toContain("100");
    expect(Object.keys(result)).toContain("0.05");
    expect(result[100]).toBe(0);
  });

  test("unknown currency defaults to INR denominations", () => {
    const result = normalizeDenominations({}, "XYZ");
    expect(result).toHaveProperty("500");
    expect(Object.keys(result).length).toBe(9);
  });

  test("string quantities are converted to numbers", () => {
    const result = normalizeDenominations({ 500: "3" }, "INR");
    expect(result[500]).toBe(3);
  });
});

describe("validateDenominations", () => {
  test("passes for valid INR denominations matching expected amount", () => {
    expect(() =>
      validateDenominations({ 500: 1, 100: 2 }, 700, "INR")
    ).not.toThrow();
  });

  test("throws on invalid denomination value", () => {
    expect(() =>
      validateDenominations({ 9999: 1 }, 9999, "INR")
    ).toThrow("Invalid denomination");
  });

  test("throws on negative quantity", () => {
    expect(() =>
      validateDenominations({ 500: -1 }, -500, "INR")
    ).toThrow("Invalid quantity");
  });

  test("throws when total does not match expected amount", () => {
    expect(() =>
      validateDenominations({ 500: 1 }, 600, "INR")
    ).toThrow("Denomination total mismatch");
  });

  test("passes for zero denominations with zero amount", () => {
    expect(() =>
      validateDenominations({ 500: 0, 100: 0 }, 0, "INR")
    ).not.toThrow();
  });

  test("handles floating point AUD correctly", () => {
    expect(() =>
      validateDenominations({ 0.5: 2, 0.1: 1 }, 1.1, "AUD")
    ).not.toThrow();
  });

  test("throws for AUD denomination not in allowed list", () => {
    expect(() =>
      validateDenominations({ 3: 1 }, 3, "AUD")
    ).toThrow("Invalid denomination");
  });
});

describe("calculateTotal", () => {
  test("returns correct total and totalCents", () => {
    const result = calculateTotal({ 500: 2, 100: 3, 50: 1 });
    expect(result.total).toBe(1350);
    expect(result.totalCents).toBe(135000);
  });

  test("returns 0 for empty denominations", () => {
    const result = calculateTotal({});
    expect(result.total).toBe(0);
    expect(result.totalCents).toBe(0);
  });

  test("handles all-zero quantities", () => {
    const result = calculateTotal({ 500: 0, 100: 0 });
    expect(result.total).toBe(0);
  });

  test("handles AUD decimal denominations without floating point error", () => {
    const result = calculateTotal({ 0.5: 3, 0.1: 1 });
    expect(result.total).toBe(1.6);
    expect(result.totalCents).toBe(160);
  });

  test("large quantities", () => {
    const result = calculateTotal({ 500: 100 });
    expect(result.total).toBe(50000);
    expect(result.totalCents).toBe(5000000);
  });
});
