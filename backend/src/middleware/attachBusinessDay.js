import pool from "../config/db.js";
import logger from "../utils/logger.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";

export async function attachBusinessDay(req, res, next) {
  if (!req.restaurantId) {
    return res.status(400).json({
      message: "Restaurant context missing",
    });
  }

  if (!req.settings) {
    return res.status(500).json({
      message: "Settings not loaded",
    });
  }

  const client = await pool.connect();

  try {
    req.businessDayId = await getBusinessDay(
      client,
      req.restaurantId,
      req.settings,
      req.user?.id
    );

    return next();
  } catch (err) {
    logger.error({ err }, "attachBusinessDay error");

    return res.status(500).json({
      message: "Failed to attach business day",
    });
  } finally {
    client.release();
  }
}