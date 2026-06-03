
import express from "express";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import { getBusinessDay } from "../utils/getBusinessDay.js";
import logger from "../utils/logger.js";

const router = express.Router();

// pg returns `date` columns as JS Date objects at local midnight — use local date methods to avoid UTC offset errors
const toDateStr = (d) => {
  if (!(d instanceof Date)) return String(d).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
/* ===============================
   GET ROSTER RANGE
================================ */
/* =========================================
   GET ROSTER RANGE (WITH WEEKLY HOURS)
========================================= */
router.get("/", authenticate, async (req, res, next) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ message: "start & end required" });
  }

  try {
    /* =========================
       SHIFTS + STAFF
    ========================= */
    const shifts = await pool.query(
      `
      SELECT
        s.id,
        TO_CHAR(s.date, 'YYYY-MM-DD') as date,
        s.shift_start,
        s.shift_end,
        s.base_rate,
        s.pay_type_id,
        json_agg(
          json_build_object(
            'id', st.id,
            'name', st.name
          )
        ) FILTER (WHERE st.id IS NOT NULL) AS staff
      FROM shifts s
      LEFT JOIN shift_assignments sa ON sa.shift_id = s.id
      LEFT JOIN staff st ON st.id = sa.staff_id
      WHERE s.restaurant_id=$1
      AND s.date BETWEEN $2 AND $3
      AND s.is_deleted = FALSE
      GROUP BY s.id
      ORDER BY s.date ASC
      `,
      [req.restaurantId, start, end]
    );

    /* =========================
       WEEKLY HOURS PER STAFF 🔥
    ========================= */
    const hours = await pool.query(
  `
  SELECT 
    st.id,
    st.name,
    COALESCE(SUM(sl.actual_hours),0) as weekly_hours
  FROM staff st
  LEFT JOIN shift_logs sl 
    ON sl.staff_id = st.id
    AND sl.created_at >= $2
    AND sl.created_at <= $3
  WHERE st.restaurant_id=$1
  GROUP BY st.id
  `,
  [req.restaurantId, start, end]
);

    const hoursMap = {};
    for (const h of hours.rows) {
      hoursMap[h.id] = Number(h.weekly_hours);
    }

    /* =========================
       MERGE HOURS INTO STAFF
    ========================= */
    const result = shifts.rows.map(shift => ({
      ...shift,
      staff: (shift.staff || []).map(s => ({
        ...s,
        weekly_hours: hoursMap[s.id] || 0
      }))
    }));

    res.json(result);

  } catch (err) {
    next(err);
  }
});


//add shift to roster
/* =========================================
   CREATE SHIFT (MULTI STAFF)
========================================= */
router.post("/", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      date,
      shift_start,
      shift_end,
      staff_ids,          // 🔥 ARRAY
      pay_type_id,        // future payroll
      base_rate,
    } = req.body;

    const { restaurantId } = req;

    /* =========================
       VALIDATION
    ========================= */
    if (!date || !shift_start || !shift_end) {
      throw new Error("Missing shift details");
    }

    if (!Array.isArray(staff_ids) || staff_ids.length === 0) {
      throw new Error("At least one staff required");
    }

    if (shift_start >= shift_end) {
      throw new Error("Invalid shift timing");
    }

    await client.query("BEGIN");

    /* =========================
       VALIDATE STAFF BELONGS TO RESTAURANT
    ========================= */
    const staffCheck = await client.query(
      `
      SELECT id FROM staff
      WHERE restaurant_id=$1 AND id = ANY($2)
      `,
      [restaurantId, staff_ids]
    );

    if (staffCheck.rows.length !== staff_ids.length) {
      throw new Error("Invalid staff selection");
    }

    /* =========================
       OVERLAP CHECK 🔥 (PER STAFF)
    ========================= */
    for (const staffId of staff_ids) {
      const overlap = await client.query(
        `
        SELECT 1
        FROM shifts s
        JOIN shift_assignments sa ON sa.shift_id = s.id
        WHERE sa.staff_id=$1
        AND s.date=$2
        AND s.is_deleted = FALSE
        AND NOT (
          $3 >= s.shift_end OR $4 <= s.shift_start
        )
        LIMIT 1
        `,
        [staffId, date, shift_start, shift_end]
      );

      if (overlap.rows.length > 0) {
        throw new Error(`Staff ${staffId} has overlapping shift`);
      }
    }

    /* =========================
       CREATE SHIFT
    ========================= */
    const shiftRes = await client.query(
      `
      INSERT INTO shifts
      (restaurant_id, date, shift_start, shift_end, pay_type_id, base_rate)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        restaurantId,
        date,
        shift_start,
        shift_end,
        pay_type_id || null,
        base_rate || 0,
      ]
    );

    const shift = shiftRes.rows[0];

    /* =========================
       ASSIGN STAFF 🔥
    ========================= */
    for (const staffId of staff_ids) {
      await client.query(
        `
        INSERT INTO shift_assignments
        (shift_id, staff_id, restaurant_id)
        VALUES ($1,$2,$3)
        `,
        [shift.id, staffId, restaurantId]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      ...shift,
      staff_ids
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   GET PAY TYPES
========================================= */
router.get("/pay-types", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, base_rate FROM pay_types WHERE restaurant_id=$1 ORDER BY name ASC`,
      [req.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   CREATE PAY TYPE
========================================= */
router.post("/pay-types", authenticate, requireAdmin, async (req, res, next) => {
  const { name, base_rate } = req.body;
  if (!name) return res.status(400).json({ message: "Name required" });
  if (base_rate == null || base_rate <= 0) return res.status(400).json({ message: "Base rate required" });
  try {
    const result = await pool.query(
      `INSERT INTO pay_types (restaurant_id, name, base_rate) VALUES ($1,$2,$3) RETURNING *`,
      [req.restaurantId, name, base_rate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Pay type already exists" });
    next(err);
  }
});

/* =========================================
   UPDATE PAY TYPE
========================================= */
router.put("/pay-types/:id", authenticate, requireAdmin, async (req, res, next) => {
  const { name, base_rate } = req.body;
  const { id } = req.params;
  if (!name) return res.status(400).json({ message: "Name required" });
  if (base_rate == null || base_rate <= 0) return res.status(400).json({ message: "Base rate required" });
  try {
    const result = await pool.query(
      `UPDATE pay_types SET name=$1, base_rate=$2 WHERE id=$3 AND restaurant_id=$4 RETURNING *`,
      [name, base_rate, id, req.restaurantId]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Pay type not found" });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Pay type name already exists" });
    next(err);
  }
});

/* =========================================
   DELETE PAY TYPE
========================================= */
router.delete("/pay-types/:id", authenticate, requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    await pool.query(
      `DELETE FROM pay_types WHERE id=$1 AND restaurant_id=$2`,
      [id, req.restaurantId]
    );
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

/* =========================================
   MY CLOCK STATUS
========================================= */
router.get("/my-status", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT sl.id, sl.clock_in, sl.clock_in_location_text, sl.clock_in_place_id,
             s.shift_start, s.shift_end, TO_CHAR(s.date, 'YYYY-MM-DD') as date
      FROM shift_logs sl
      JOIN shifts s ON s.id = sl.shift_id
      WHERE sl.staff_id = $1
        AND sl.clock_out IS NULL
      ORDER BY sl.clock_in DESC
      LIMIT 1
      `,
      [req.user.id]
    );
    res.json({
      clocked_in: result.rows.length > 0,
      log: result.rows[0] || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/my-shifts", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT s.id, TO_CHAR(s.date, 'YYYY-MM-DD') as date,
             s.shift_start, s.shift_end, s.restaurant_id
      FROM shift_assignments sa
      JOIN shifts s ON s.id = sa.shift_id
      WHERE sa.staff_id=$1
      AND s.restaurant_id=$2
      AND s.date >= CURRENT_DATE
      ORDER BY s.date ASC
      `,
      [req.user.id, req.restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   CLOCK IN (SMART + AUTO FIX)
========================================= */
router.post("/clock-in", authenticate, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { restaurantId, userId } = req;
    const { place_id, location_text } = req.body;

    await client.query("BEGIN");

    const now = new Date();

    /* =========================
       FIND ACTIVE SHIFT 🔥
    ========================= */
    const shiftRes = await client.query(
      `
      SELECT s.*
      FROM shifts s
      JOIN shift_assignments sa ON sa.shift_id = s.id
      WHERE sa.staff_id=$1
      AND s.restaurant_id=$2
      AND s.is_deleted=FALSE
      AND s.date = CURRENT_DATE
      ORDER BY s.shift_start ASC
      `,
      [userId, restaurantId]
    );

    if (!shiftRes.rows.length) {
      throw new Error("No shift assigned today");
    }

   let activeShift = null;
   let bestDiff = Infinity;

   for (const s of shiftRes.rows) {
     const dateStr = toDateStr(s.date);
     const start = new Date(`${dateStr}T${s.shift_start}`);
     const end   = new Date(`${dateStr}T${s.shift_end}`);
     const earlyWindow = new Date(start.getTime() - 60 * 60 * 1000); // 1hr before start

     if (now >= earlyWindow && now <= end) {
       const diff = Math.abs(now - start);
       if (diff < bestDiff) {
         bestDiff = diff;
         activeShift = s;
       }
     }
   }

   if (!activeShift) {
     throw new Error("Clock-in not allowed at this time");
   }

    /* =========================
       PREVENT DOUBLE CLOCK-IN
    ========================= */
    const existing = await client.query(
      `
      SELECT 1 FROM shift_logs
      WHERE shift_id=$1 AND staff_id=$2 AND clock_out IS NULL
      `,
      [activeShift.id, userId]
    );

    if (existing.rows.length) {
      throw new Error("Already clocked in");
    }

    /* =========================
       AUTO CLOCK-OUT PREVIOUS 🔥
    ========================= */
    const openShift = await client.query(
      `
      SELECT sl.*, s.shift_end, s.date
      FROM shift_logs sl
      JOIN shifts s ON s.id = sl.shift_id
      WHERE sl.staff_id=$1
      AND sl.clock_out IS NULL
      ORDER BY sl.clock_in DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (openShift.rows.length) {
      const prev = openShift.rows[0];

      const prevEnd = new Date(`${toDateStr(prev.date)}T${prev.shift_end}`);

      const currentStart = new Date(
        `${toDateStr(activeShift.date)}T${activeShift.shift_start}`
      );

      /* =========================
   FIND NEXT SHIFT 🔥
========================= */
const nextShift = await client.query(
  `
  SELECT s.*
  FROM shifts s
  JOIN shift_assignments sa ON sa.shift_id = s.id
  WHERE sa.staff_id=$1
  AND s.date >= CURRENT_DATE
  AND (
    s.date > $2 OR
    (s.date = $2 AND s.shift_start > $3)
  )
  ORDER BY s.date ASC, s.shift_start ASC
  LIMIT 1
  `,
  [userId, prev.date, prev.shift_end]
);

let forcedOut;

const COOLDOWN = 8 * 60 * 60 * 1000; // 8hr cooldown

if (nextShift.rows.length) {
  const next = nextShift.rows[0];
  const nextStart = new Date(`${toDateStr(next.date)}T${next.shift_start}`);

  // Only use the next-shift rule if the next shift starts within 8hrs of prev shift end
  if (nextStart - prevEnd <= COOLDOWN) {
    forcedOut = new Date(nextStart.getTime() - 60 * 60 * 1000); // 1hr before next shift
  } else {
    forcedOut = prevEnd; // no overlap — close at shift end
  }
} else {
  // No next shift → auto-close at original shift end time
  forcedOut = prevEnd;
}

// Safety: never record clock-out before clock-in
if (forcedOut < new Date(prev.clock_in)) {
  forcedOut = prevEnd;
}

      const hours =
        (forcedOut - new Date(prev.clock_in)) / (1000 * 60 * 60);

      await client.query(
        `
        UPDATE shift_logs
        SET
          clock_out=$1,
          actual_hours=$2,
          is_auto_closed=TRUE,
          status='auto_closed'
        WHERE id=$3
        `,
        [forcedOut, Math.max(0, hours), prev.id]
      );
    }

    /* =========================
       INSERT CLOCK-IN
    ========================= */
    const log = await client.query(
      `
      INSERT INTO shift_logs
      (restaurant_id, shift_id, staff_id, clock_in, clock_in_location_text, clock_in_place_id)
      VALUES ($1,$2,$3,NOW(),$4,$5)
      RETURNING *
      `,
      [restaurantId, activeShift.id, userId, location_text || null, place_id || null]
    );

    await client.query("COMMIT");

    res.json({
      message: "Clock-in successful",
      shift_id: activeShift.id,
      log: log.rows[0]
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   CLOCK OUT (PAYROLL READY)
========================================= */
router.post("/clock-out", authenticate, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { restaurantId, userId } = req;
const { place_id, location_text } = req.body;
    await client.query("BEGIN");

    /* =========================
       FIND ACTIVE LOG
    ========================= */
    const logRes = await client.query(
      `
      SELECT sl.*, s.shift_start, s.shift_end, s.date,
             s.base_rate
      FROM shift_logs sl
      JOIN shifts s ON s.id = sl.shift_id
      WHERE sl.staff_id=$1
      AND s.restaurant_id=$2
      AND sl.clock_out IS NULL
      ORDER BY sl.clock_in DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId, restaurantId]
    );

    if (!logRes.rows.length) {
      throw new Error("No active shift found");
    }

    const log = logRes.rows[0];

    const now = new Date();
    const clockIn = new Date(log.clock_in);

    const shiftStart = new Date(`${toDateStr(log.date)}T${log.shift_start}`);
    const shiftEnd = new Date(`${toDateStr(log.date)}T${log.shift_end}`);

    /* =========================
       PREVENT INVALID CLOCK-OUT
    ========================= */
    if (now < clockIn) {
      throw new Error("Invalid clock-out time");
    }

    /* =========================
       CALCULATE HOURS 🔥
    ========================= */
    const actualHours =
      (now - clockIn) / (1000 * 60 * 60);

    const scheduledHours =
      (shiftEnd - shiftStart) / (1000 * 60 * 60);


    /* =========================
       OPTIONAL CLAMP (ANTI-ABUSE)
    ========================= */
    const MAX_SHIFT = scheduledHours + 8; // max allowed

const finalHours = Math.min(actualHours, scheduledHours + 8); // safety clamp

    /* =========================
       UPDATE LOG
    ========================= */
    const updated = await client.query(
      `
      UPDATE shift_logs
      SET
        clock_out = NOW(),
        clock_out_location_text = $1,
        clock_out_place_id = $2,
        actual_hours = $3,
        status = 'completed'
      WHERE id = $4
      RETURNING *
      `,
      [
        location_text || null,
        place_id || null,
        finalHours,
        log.id
      ]
    );

    await client.query("COMMIT");

    res.json({
      message: "Clock-out successful",
      actualHours: Number(finalHours.toFixed(2)),
      log: updated.rows[0]
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* =========================================
   ADMIN LIVE STAFF OVERVIEW
========================================= */
router.get("/overview", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req;

    const result = await pool.query(
      `
      SELECT
  s.id as shift_id,
  TO_CHAR(s.date, 'YYYY-MM-DD') as date,
  s.shift_start,
  s.shift_end,

  st.id as id,
  st.id as staff_id,
  st.name,

  sl.clock_in,
  sl.clock_out

FROM shifts s
JOIN shift_assignments sa ON sa.shift_id = s.id
JOIN staff st ON st.id = sa.staff_id

/* 🔥 FIX HERE */
LEFT JOIN LATERAL (
  SELECT *
  FROM shift_logs sl
  WHERE sl.shift_id = s.id 
  AND sl.staff_id = st.id
  ORDER BY sl.clock_in DESC
  LIMIT 1
) sl ON true

WHERE s.restaurant_id=$1
AND s.is_deleted=FALSE
AND s.date = CURRENT_DATE;
      `,
      [restaurantId]
    );

    const now = new Date();

    const response = {
      working: [],
      late: [],
      absent: [],
      upcoming: [],
      totalActive: 0
    };

    for (const row of result.rows) {
      const shiftStart = new Date(`${toDateStr(row.date)}T${row.shift_start}`);
      const shiftEnd = new Date(`${toDateStr(row.date)}T${row.shift_end}`);

      const isWorking = row.clock_in && !row.clock_out;

      const grace = 15 * 60 * 1000; // 15 mins

      /* =========================
         WORKING
      ========================= */
      if (isWorking) {
        response.working.push({ ...row, status: "working" });
        continue;
      }

      /* =========================
         UPCOMING
      ========================= */
      if (now < shiftStart) {
        response.upcoming.push({ ...row, status: "upcoming" });
        continue;
      }

      /* =========================
         LATE
      ========================= */
      if (
        now >= shiftStart &&
        now <= new Date(shiftStart.getTime() + grace) &&
        !row.clock_in
      ) {
        response.late.push({ ...row, status: "late" });
        continue;
      }

      /* =========================
         ABSENT
      ========================= */
      if (now > new Date(shiftStart.getTime() + grace) && !row.clock_in) {
        response.absent.push({ ...row, status: "absent" });
      }
    }

    response.totalActive = response.working.length;

    res.json(response);

  } catch (err) {
    next(err);
  }
});

router.get("/shifts", authenticate, requireAdmin, async (req, res, next) => {
  const { start, end, mode = "roster" } = req.query;
  const { restaurantId } = req;

  if (!start || !end) {
  return res.status(400).json({
    message: "start & end required"
  });
}

  try { const result = await pool.query(`
    SELECT 
      s.id as shift_id,
      s.date,
      s.shift_start,
      s.shift_end,

      st.id as staff_id,
      st.name,

      sl.clock_in,
      sl.clock_out,
      sl.actual_hours,

      s.base_rate

    FROM shifts s
    JOIN shift_assignments sa ON sa.shift_id = s.id
    JOIN staff st ON st.id = sa.staff_id

    LEFT JOIN LATERAL (
      SELECT *
      FROM shift_logs sl
      WHERE sl.shift_id = s.id
      AND sl.staff_id = st.id
      ORDER BY sl.clock_in DESC
      LIMIT 1
    ) sl ON true

    WHERE s.restaurant_id=$1
    AND s.date BETWEEN $2 AND $3
    AND s.is_deleted=FALSE
    ORDER BY s.date ASC
  `, [restaurantId, start, end]);

  const data = result.rows.map(r => {
    let hours = 0;

    if (mode === "actual") {
      hours = Number(r.actual_hours || 0);
    } else {
      const start = new Date(`${toDateStr(r.date)}T${r.shift_start}`);
      const end = new Date(`${toDateStr(r.date)}T${r.shift_end}`);
      hours = (end - start) / (1000 * 60 * 60);
    }

    return {
      ...r,
      hours
    };
  });

  res.json(data);
  } catch (err) { next(err); }
});

/* =========================================
   SEND TO XERO (AUD ONLY + REMAINING HOURS)
========================================= */
router.post("/send-to-xero", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { shifts } = req.body;
    const { restaurantId, settings } = req;

    /* =========================
       AUD VERSION ONLY 🔥
    ========================= */
    if (settings?.currency?.code !== "AUD") {
      return res.status(403).json({
        message: "Payroll available only for AUD version"
      });
    }

    if (!Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({
        message: "No shifts provided"
      });
    }

    await client.query("BEGIN");

    /* =========================
       CREATE BATCH
    ========================= */
    const batchRes = await client.query(
      `
      INSERT INTO payroll_batches (restaurant_id)
      VALUES ($1)
      RETURNING *
      `,
      [restaurantId]
    );

    const batchId = batchRes.rows[0].id;

    let inserted = 0;

    /* =========================
       PROCESS SHIFTS 🔥
    ========================= */
    for (const s of shifts) {

      /* -------------------------
         VALIDATION
      ------------------------- */
      if (!s.shift_id || !s.staff_id || !s.hours) continue;

      /* -------------------------
         GET ALREADY PAID HOURS
      ------------------------- */
      const paidRes = await client.query(
        `
        SELECT COALESCE(SUM(hours),0) as paid
        FROM payroll_entries
        WHERE shift_id=$1 AND staff_id=$2
        AND status = 'paid'
        `,
        [s.shift_id, s.staff_id]
      );

      const alreadyPaid = Number(paidRes.rows[0].paid);

      /* -------------------------
         CALCULATE REMAINING
      ------------------------- */
      const remaining = Number(s.hours) - alreadyPaid;

      if (remaining <= 0) {
        continue; // skip fully paid
      }

      /* -------------------------
         INSERT ENTRY
      ------------------------- */
      await client.query(
        `
        INSERT INTO payroll_entries
        (batch_id, shift_id, staff_id, hours, status)
        VALUES ($1,$2,$3,$4,'pending')
        `,
        [batchId, s.shift_id, s.staff_id, remaining]
      );

      inserted++;
    }

    /* =========================
       NOTHING TO SEND
    ========================= */
    if (inserted === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "All selected shifts are already fully paid"
      });
    }

    /* =========================
       MARK BATCH
    ========================= */
    await client.query(
      `
      UPDATE payroll_batches
      SET status = 'ready'
      WHERE id=$1
      `,
      [batchId]
    );

    await client.query("COMMIT");

    res.json({
      message: "Payroll batch prepared for Xero",
      batch_id: batchId,
      shifts_processed: inserted
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

router.get("/logs", authenticate, requireAdmin, async (req, res, next) => {
  const { start, end } = req.query;
  const { restaurantId } = req;

  try { const result = await pool.query(`
    SELECT 
      st.name,
      s.date,
      s.shift_start,
      s.shift_end,

      sl.clock_in,
      sl.clock_out,
      sl.clock_in_location_text,
      sl.clock_out_location_text

    FROM shift_logs sl
    JOIN shifts s ON s.id = sl.shift_id
    JOIN staff st ON st.id = sl.staff_id

    WHERE s.restaurant_id=$1
    AND s.date BETWEEN $2 AND $3
    ORDER BY sl.clock_in DESC
  `, [restaurantId, start, end]);

  res.json(result.rows);
  } catch (err) { next(err); }
});

/* =========================================
   COPY ROSTER (FULLY FIXED)
========================================= */
router.post("/copy", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { from_date, to_date } = req.body;
    const { restaurantId } = req;

    if (!from_date || !to_date) {
      throw new Error("from_date and to_date required");
    }

    await client.query("BEGIN");

    /* =========================
       GET SHIFTS FROM SOURCE
    ========================= */
    const source = await client.query(
      `
      SELECT *
      FROM shifts
      WHERE restaurant_id=$1
      AND date=$2
      AND is_deleted=FALSE
      `,
      [restaurantId, from_date]
    );

    for (const shift of source.rows) {

      /* =========================
         INSERT NEW SHIFT (WITH PAY)
      ========================= */
      const newShift = await client.query(
        `
        INSERT INTO shifts 
        (restaurant_id, date, shift_start, shift_end, pay_type_id, base_rate)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id
        `,
        [
          restaurantId,
          to_date,
          shift.shift_start,
          shift.shift_end,
          shift.pay_type_id,
          shift.base_rate
        ]
      );

      /* =========================
         COPY STAFF ASSIGNMENTS
      ========================= */
      const staff = await client.query(
        `
        SELECT staff_id
        FROM shift_assignments
        WHERE shift_id=$1
        `,
        [shift.id]
      );

      for (const s of staff.rows) {
        await client.query(
          `
          INSERT INTO shift_assignments (shift_id, staff_id, restaurant_id)
          VALUES ($1,$2,$3)
          `,
          [newShift.rows[0].id, s.staff_id, restaurantId]
        );
      }
    }

    await client.query("COMMIT");

    res.json({ message: "Roster copied successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});
//update shift
/* =========================================
   UPDATE SHIFT (SAFE)
========================================= */
router.put("/:id", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      date,
      shift_start,
      shift_end,
      staff_ids,
      pay_type_id,
      base_rate,
    } = req.body;

    const { restaurantId } = req;

    await client.query("BEGIN");

    /* =========================
       FETCH SHIFT
    ========================= */
    const shiftRes = await client.query(
      `
      SELECT * FROM shifts
      WHERE id=$1 AND restaurant_id=$2
      FOR UPDATE
      `,
      [id, restaurantId]
    );

    if (!shiftRes.rows.length) {
      throw new Error("Shift not found");
    }

    const shift = shiftRes.rows[0];

    /* =========================
       NEW VALUES (FALLBACK SAFE)
    ========================= */
    const newDate = date || toDateStr(shift.date);
    const newStart = shift_start || shift.shift_start;
    const newEnd = shift_end || shift.shift_end;

    if (newStart >= newEnd) {
      throw new Error("Invalid shift timing");
    }

    /* =========================
       VALIDATE STAFF (IF PROVIDED)
    ========================= */
    if (staff_ids) {
      if (!Array.isArray(staff_ids) || staff_ids.length === 0) {
        throw new Error("At least one staff required");
      }

      const staffCheck = await client.query(
        `
        SELECT id FROM staff
        WHERE restaurant_id=$1 AND id = ANY($2)
        `,
        [restaurantId, staff_ids]
      );

      if (staffCheck.rows.length !== staff_ids.length) {
        throw new Error("Invalid staff selection");
      }

      /* =========================
         OVERLAP CHECK 🔥
      ========================= */
      for (const staffId of staff_ids) {
        const overlap = await client.query(
          `
          SELECT 1
          FROM shifts s
          JOIN shift_assignments sa ON sa.shift_id = s.id
          WHERE sa.staff_id=$1
          AND s.id != $2
          AND s.date=$3
          AND s.is_deleted = FALSE
          AND NOT (
            $4 >= s.shift_end OR $5 <= s.shift_start
          )
          LIMIT 1
          `,
          [staffId, id, newDate, newStart, newEnd]
        );

        if (overlap.rows.length > 0) {
          throw new Error(`Staff ${staffId} has overlapping shift`);
        }
      }
    }

    /* =========================
       UPDATE SHIFT CORE
    ========================= */
    const updatedShift = await client.query(
      `
      UPDATE shifts
      SET
        date = $1,
        shift_start = $2,
        shift_end = $3,
        pay_type_id = COALESCE($4, pay_type_id),
        base_rate = COALESCE($5, base_rate)
      WHERE id=$6
      RETURNING *
      `,
      [
        newDate,
        newStart,
        newEnd,
        pay_type_id,
        base_rate,
        id
      ]
    );

    /* =========================
       REASSIGN STAFF 🔥
    ========================= */
    if (staff_ids) {
      await client.query(
        `DELETE FROM shift_assignments WHERE shift_id=$1`,
        [id]
      );

      for (const staffId of staff_ids) {
        await client.query(
          `
          INSERT INTO shift_assignments (shift_id, staff_id, restaurant_id)
          VALUES ($1,$2,$3)
          `,
          [id, staffId, restaurantId]
        );
      }
    }

    await client.query("COMMIT");

    res.json({
      ...updatedShift.rows[0],
      staff_ids: staff_ids || null
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});


//delete shift
/* =========================================
   DELETE SHIFT (SAFE - SOFT DELETE)
========================================= */
router.delete("/:id", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { restaurantId } = req;

    await client.query("BEGIN");

    /* =========================
       FETCH SHIFT
    ========================= */
    const shiftRes = await client.query(
      `
      SELECT *
      FROM shifts
      WHERE id=$1 AND restaurant_id=$2 AND is_deleted=FALSE
      FOR UPDATE
      `,
      [id, restaurantId]
    );

    if (!shiftRes.rows.length) {
      throw new Error("Shift not found");
    }

    const shift = shiftRes.rows[0];

    /* =========================
       SOFT DELETE
    ========================= */
    await client.query(
      `
      UPDATE shifts
      SET is_deleted=TRUE
      WHERE id=$1
      `,
      [id]
    );

    await client.query("COMMIT");

    res.json({ message: "Shift deleted successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

export default router;
