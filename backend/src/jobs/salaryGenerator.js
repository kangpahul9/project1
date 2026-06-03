import pool from "../config/db.js";
import logger from "../utils/logger.js";

export const generateMonthlySalary = async () => {
  try {
    // 🔥 preload settings
    const settingsRes = await pool.query(`
      SELECT restaurant_id, currency_code
      FROM restaurant_settings
    `);

    const settingsMap = new Map();
    settingsRes.rows.forEach(row => {
      settingsMap.set(row.restaurant_id, row.currency_code);
    });

    const staffRes = await pool.query(`
      SELECT id, salary, joining_date, restaurant_id
      FROM staff
      WHERE is_active = TRUE
    `);

    // 🔥 IMPORTANT: force IST timezone
    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const currentDay = today.getDate();

    const monthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    const monthName = today.toLocaleString("en-IN", { month: "short" });
    const year = today.getFullYear();
    const reason = `Salary - ${monthName} ${year}`;

    for (const staff of staffRes.rows) {
      try {
        // ✅ fallback to INR if missing
        const currency =
          settingsMap.get(staff.restaurant_id) || "INR";

        if (currency !== "INR") continue;

        // skip if no salary defined
        if (!staff.salary) continue;

        const joinDay = new Date(staff.joining_date).getDate();
        if (joinDay !== currentDay) continue;

        // 🔥 atomic insert (no duplicate race condition)
        await pool.query(
          `
          INSERT INTO staff_transactions 
          (
            restaurant_id,
            staff_id,
            amount,
            type,
            reason,
            salary_month
          )
          SELECT $1,$2,$3,'adjustment',$4,$5
          WHERE NOT EXISTS (
            SELECT 1 FROM staff_transactions
            WHERE restaurant_id = $1
            AND staff_id = $2
            AND salary_month = $5
          )
          `,
          [
            staff.restaurant_id,
            staff.id,
            staff.salary,
            reason,
            monthStart
          ]
        );

      } catch (innerErr) {
        logger.error({ err: innerErr, staffId: staff.id }, "Salary generation error for staff");
      }
    }

  } catch (err) {
    logger.error({ err }, "Salary generator failed");
  }
};