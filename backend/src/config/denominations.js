import logger from "../utils/logger.js";

export const DENOMINATIONS = {
  INR: [500, 200, 100, 50, 20, 10, 5, 2, 1],
  AUD: [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05]
};

export function getAllowedDenominations(currency = "INR") {
  if (!DENOMINATIONS[currency]) {
    logger.warn({ currency }, "Unsupported currency, defaulting to INR");
    return DENOMINATIONS["INR"];
  }
  return DENOMINATIONS[currency];
}