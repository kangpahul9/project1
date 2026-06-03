import { calculateChange } from "../../src/utils/changeCalculator.js";

const drawer = (entries) =>
  entries.map(([note_value, quantity]) => ({ note_value, quantity }));

describe("calculateChange", () => {
  test("exact change with single denomination", () => {
    const result = calculateChange(100, drawer([[100, 5]]));
    expect(result).toEqual([{ note_value: 100, quantity: 1 }]);
  });

  test("greedy: uses largest notes first", () => {
    const result = calculateChange(
      150,
      drawer([[100, 2], [50, 3], [10, 5]])
    );
    expect(result).toEqual([
      { note_value: 100, quantity: 1 },
      { note_value: 50, quantity: 1 },
    ]);
  });

  test("uses multiple denominations when needed", () => {
    const result = calculateChange(
      70,
      drawer([[100, 1], [50, 2], [20, 3], [10, 5]])
    );
    expect(result).toEqual([
      { note_value: 50, quantity: 1 },
      { note_value: 20, quantity: 1 },
    ]);
  });

  test("returns null when exact change cannot be made", () => {
    const result = calculateChange(75, drawer([[50, 1], [100, 1]]));
    expect(result).toBeNull();
  });

  test("returns null when drawer is empty", () => {
    const result = calculateChange(50, []);
    expect(result).toBeNull();
  });

  test("returns [] for zero change amount", () => {
    const result = calculateChange(0, drawer([[100, 5], [50, 5]]));
    expect(result).toEqual([]);
  });

  test("respects available quantity — does not exceed drawer stock", () => {
    // Only 1 x 100 in drawer, need 200 change → should use 2x100 but only 1 available → null
    const result = calculateChange(200, drawer([[100, 1], [50, 1]]));
    expect(result).toBeNull();
  });

  test("uses all available notes of one denomination when needed", () => {
    const result = calculateChange(
      300,
      drawer([[100, 3], [50, 2]])
    );
    expect(result).toEqual([{ note_value: 100, quantity: 3 }]);
  });

  test("floating point: AUD 0.50 change", () => {
    const result = calculateChange(0.5, drawer([[0.5, 2], [0.2, 5], [0.1, 5]]));
    expect(result).toEqual([{ note_value: 0.5, quantity: 1 }]);
  });

  test("floating point: AUD 0.30 change from small coins", () => {
    const result = calculateChange(
      0.3,
      drawer([[0.2, 1], [0.1, 2]])
    );
    expect(result).toEqual([
      { note_value: 0.2, quantity: 1 },
      { note_value: 0.1, quantity: 1 },
    ]);
  });

  test("skips denominations with zero quantity", () => {
    const result = calculateChange(
      50,
      drawer([[100, 0], [50, 1], [20, 5]])
    );
    expect(result).toEqual([{ note_value: 50, quantity: 1 }]);
  });

  test("returns null when no combination of available notes can make the amount", () => {
    // Only 50-notes in drawer, need 75 — greedy uses 1x50, remaining 25 — can't make 25 with 50s
    const result = calculateChange(75, drawer([[50, 3]]));
    expect(result).toBeNull();
  });

  test("exact large amount", () => {
    const result = calculateChange(
      700,
      drawer([[500, 2], [200, 2], [100, 2]])
    );
    expect(result).toEqual([
      { note_value: 500, quantity: 1 },
      { note_value: 200, quantity: 1 },
    ]);
  });
});
