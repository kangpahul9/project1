export async function attachBusinessDay(req,res,next){
  const client = await pool.connect()

  try{
    req.businessDayId = await getBusinessDay(
      client,
      req.restaurantId,
      req.settings,
      req.user?.id   // ✅ ADD THIS
    )
    next()
  } catch(err){
    next(err)
  } finally{
    client.release()
  }
}