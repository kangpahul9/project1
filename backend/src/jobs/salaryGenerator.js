import pool from "../config/db.js";

export const generateMonthlySalary = async () => {
  try {
    const staffRes = await pool.query(`
      SELECT id, salary, joining_date, restaurant_id
      FROM staff
      WHERE is_active = TRUE
    `);

    const today = new Date();
    const day = today.getDate();

    const monthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    // prettier reason like "Salary - Mar 2026"
    const monthName = today.toLocaleString("en-IN", { month: "short" });
    const year = today.getFullYear();
    const reason = `Salary - ${monthName} ${year}`;

    for (const staff of staffRes.rows) {

      const joinDay = new Date(staff.joining_date).getDate();

      if (joinDay !== day) continue;

      const check = await pool.query(
        `
        SELECT id
FROM staff_transactions
WHERE restaurant_id=$1
AND staff_id=$2
AND salary_month=$3
        `,
        [staff.restaurant_id, staff.id, monthStart]
      );

      if (check.rows.length > 0) continue;

      await pool.query(
        `
        INSERT INTO staff_transactions 
        (restaurant_id,staff_id, amount, type, reason, salary_month)
        VALUES ($1,$2,$3,'adjustment',$4,$5)
        `,
        [staff.restaurant_id,staff.id, staff.salary, reason, monthStart]
      );
    }

  } catch (err) {
    console.error("Salary generator failed:", err);
  }
};