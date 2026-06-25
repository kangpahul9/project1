import pool from "../config/db.js";
import logger from "../utils/logger.js";

const toDateStr = (d) => {
  if (!(d instanceof Date)) return String(d).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * Auto clock-out rules (runs every 15 minutes via cron):
 *
 * For each unclosed shift_log:
 *   - If the staff has a NEXT shift starting within 8hrs of this shift's end:
 *       close at (nextShiftStart - 1hr)  ← so clock-in for next shift becomes available
 *   - Otherwise, close at shift_end once 8hrs have elapsed since shift_end
 *
 * The recorded clock_out time is always the rule-determined time,
 * NOT the current wall-clock time.
 */
export async function autoClockOut() {
  const client = await pool.connect();

  try {
    // Find all unclosed logs where shift has already ended
    const openLogs = await client.query(`
      SELECT
        sl.id          AS log_id,
        sl.staff_id,
        sl.shift_id,
        sl.clock_in,
        s.shift_start,
        s.shift_end,
        s.date,
        s.restaurant_id
      FROM shift_logs sl
      JOIN shifts s ON s.id = sl.shift_id
      WHERE sl.clock_out IS NULL
        AND (s.date + s.shift_end::interval) < NOW()
    `);

    if (!openLogs.rows.length) return;

    const now = new Date();
    const COOLDOWN = 8 * 60 * 60 * 1000;

    for (const log of openLogs.rows) {
      const dateStr  = toDateStr(log.date);
      const shiftEnd = new Date(`${dateStr}T${log.shift_end}`);

      // Find next assigned shift for this staff member after this one
      const nextRes = await client.query(
        `
        SELECT s.*
        FROM shifts s
        JOIN shift_assignments sa ON sa.shift_id = s.id
        WHERE sa.staff_id = $1
          AND s.restaurant_id = $2
          AND s.is_deleted = FALSE
          AND (s.date > $3 OR (s.date = $3 AND s.shift_start > $4))
        ORDER BY s.date ASC, s.shift_start ASC
        LIMIT 1
        `,
        [log.staff_id, log.restaurant_id, log.date, log.shift_end]
      );

      let closeAt = null;

      if (nextRes.rows.length) {
        const next      = nextRes.rows[0];
        const nextStart = new Date(`${toDateStr(next.date)}T${next.shift_start}`);
        const oneHrBefore = new Date(nextStart.getTime() - 60 * 60 * 1000);

        if (nextStart - shiftEnd <= COOLDOWN) {
          // Next shift within 8hrs — close 1hr before it starts
          if (now >= oneHrBefore) {
            closeAt = oneHrBefore;
          }
        }
      }

      // No next-shift rule fired — close at shift end after 8hr cooldown
      if (!closeAt && now - shiftEnd >= COOLDOWN) {
        closeAt = shiftEnd;
      }

      if (!closeAt) continue; // cooldown hasn't expired yet

      // Safety: never record clock-out before clock-in
      const clockIn = new Date(log.clock_in);
      if (closeAt < clockIn) closeAt = shiftEnd;

      const actualHours = Math.max(0, (closeAt - clockIn) / (1000 * 60 * 60));

      await client.query(
        `
        UPDATE shift_logs
        SET clock_out      = $1,
            actual_hours   = $2,
            is_auto_closed = TRUE
        WHERE id = $3
        `,
        [closeAt, actualHours, log.log_id]
      );

      logger.info(
        { logId: log.log_id, staffId: log.staff_id, closeAt },
        "Auto clock-out applied"
      );
    }
  } catch (err) {
    logger.error({ err }, "autoClockOut job failed");
  } finally {
    client.release();
  }
}
