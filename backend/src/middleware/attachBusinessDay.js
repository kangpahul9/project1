import pool from "../config/db.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";

export async function attachBusinessDay(req,res,next){
  const client = await pool.connect()

  try{
    req.businessDayId = await getBusinessDay(
      client,
      req.restaurantId,
      req.settings
    )
    next()
  } catch(err){
    next(err)
  } finally{
    client.release()
  }
}