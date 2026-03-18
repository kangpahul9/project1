import pool from "../config/db.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";

export async function attachBusinessDay(req, res, next) {

  if (!req.restaurantId || !req.settings) {
    return next();
  }

  const client = await pool.connect();

  try {
    req.businessDayId = await getBusinessDay(
      client,
      req.restaurantId,
      req.settings,
      req.user?.id
    );

    next();
  } catch (err) {
    return next(err);
  } finally {
    client.release();
  }
}