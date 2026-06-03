import { getAllowedDenominations } from "../config/denominations.js";

const toCents = (val) => Math.round(Number(val) * 100);

/* =========================================
   NORMALIZE (ensures all notes exist)
========================================= */
export function normalizeDenominations(input = {}, currency = "INR") {
  const allowed = getAllowedDenominations(currency);
  const normalized = {};

  for (const note of allowed) {
    normalized[note] = Number(input[note] || 0);
  }

  return normalized;
}

/* =========================================
   VALIDATE DENOMINATIONS
========================================= */
export function validateDenominations(
  denominations,
  expectedAmount,
  currency = "INR"
) {
  const allowed = getAllowedDenominations(currency);

  let total = 0;

  for (const [value, qty] of Object.entries(denominations)) {
    const note = Number(value);
    const q = Number(qty);

    if (!allowed.includes(note)) {
      throw new Error(`Invalid denomination: ${note}`);
    }

    if (q < 0) {
      throw new Error(`Invalid quantity for ${note}`);
    }

    total += toCents(note) * q;
  }

  if (total !== toCents(expectedAmount)) {
    throw new Error("Denomination total mismatch");
  }
}

/* =========================================
   CALCULATE TOTAL (SAFE)
========================================= */
export function calculateTotal(denominations) {
  const totalCents = Object.entries(denominations).reduce(
    (sum, [note, qty]) => {
      return sum + Math.round(Number(note) * 100) * Number(qty);
    },
    0
  );

  return {
    total: totalCents / 100,
    totalCents
  };
}