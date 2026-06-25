import express from "express";
import { createHmac, timingSafeEqual } from "crypto";
import pool from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";
import { encrypt, decrypt } from "../utils/crypto.js";

const router = express.Router();

const CLIENT_ORIGIN = process.env.CLIENT_URL || "*";

function signState(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", process.env.JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyState(state) {
  const lastDot = state.lastIndexOf(".");
  if (lastDot === -1) throw new Error("Invalid state format");
  const data = state.slice(0, lastDot);
  const sig = state.slice(lastDot + 1);
  const expected = createHmac("sha256", process.env.JWT_SECRET).update(data).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid state — possible CSRF attack");
  }
  return JSON.parse(Buffer.from(data, "base64url").toString());
}

// Ensure advance_deduction_type_id column exists (idempotent)
pool.query(`ALTER TABLE xero_connections ADD COLUMN IF NOT EXISTS advance_deduction_type_id TEXT`)
  ?.catch(() => {}); // silently ignore if table doesn't exist yet

const XERO_CLIENT_ID     = process.env.XERO_CLIENT_ID;
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET;
const XERO_REDIRECT_URI  = process.env.XERO_REDIRECT_URI;
const XERO_SCOPES        = "openid profile email payroll.employees payroll.timesheets payroll.settings offline_access";

/* ── Token helpers ─────────────────────────────────────────────────────────── */

async function getConnection(restaurantId) {
  const r = await pool.query(
    `SELECT * FROM xero_connections WHERE restaurant_id=$1`,
    [restaurantId]
  );
  if (!r.rows[0]) return null;
  const conn = r.rows[0];
  conn.access_token  = decrypt(conn.access_token);
  conn.refresh_token = decrypt(conn.refresh_token);
  return conn;
}

async function refreshIfNeeded(conn, restaurantId) {
  if (!conn) throw new Error("Xero not connected");

  const expiresAt = new Date(conn.expires_at);
  const nowPlus5  = new Date(Date.now() + 5 * 60 * 1000); // refresh 5 min before expiry

  if (expiresAt > nowPlus5) return conn.access_token; // still valid

  // Refresh
  const params = new URLSearchParams({
    grant_type:    "refresh_token",
    refresh_token: conn.refresh_token,
    client_id:     XERO_CLIENT_ID,
    client_secret: XERO_CLIENT_SECRET,
  });

  const res = await fetch("https://identity.xero.com/connect/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xero token refresh failed: ${err}`);
  }

  const data = await res.json();
  const expiryTs = new Date(Date.now() + data.expires_in * 1000);

  await pool.query(
    `UPDATE xero_connections
     SET access_token=$1, refresh_token=$2, expires_at=$3
     WHERE restaurant_id=$4`,
    [encrypt(data.access_token), encrypt(data.refresh_token), expiryTs, restaurantId]
  );

  return data.access_token;
}

/* ── OAuth: initiate connect ─────────────────────────────────────────────── */
router.get("/connect", authenticate, requireAdmin, (req, res) => {
  if (!XERO_CLIENT_ID) {
    return res.status(503).json({ message: "Xero credentials not configured. Add XERO_CLIENT_ID and XERO_CLIENT_SECRET to .env" });
  }

  // HMAC-signed state prevents CSRF on the OAuth callback
  const state = signState({ restaurantId: req.restaurantId });

  const url = new URL("https://login.xero.com/identity/connect/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id",     XERO_CLIENT_ID);
  url.searchParams.set("redirect_uri",  XERO_REDIRECT_URI);
  url.searchParams.set("scope",         XERO_SCOPES);
  url.searchParams.set("state",         state);

  res.json({ url: url.toString() });
});

/* ── OAuth: callback ─────────────────────────────────────────────────────── */
router.get("/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) throw new Error(`Xero auth error: ${error}`);
    if (!code || !state) throw new Error("Missing code or state");

    const { restaurantId } = verifyState(state);

    // Exchange code for tokens
    const params = new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: XERO_REDIRECT_URI,
    });

    const tokenRes = await fetch("https://identity.xero.com/connect/token", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64"),
      },
      body: params,
    });

    if (!tokenRes.ok) throw new Error("Token exchange failed: " + await tokenRes.text());
    const tokens = await tokenRes.json();

    // Get tenant list (choose first AU payroll tenant)
    const connRes = await fetch("https://api.xero.com/connections", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const connections = await connRes.json();
    const tenant = connections.find(c => c.tenantType === "ORGANISATION") || connections[0];

    if (!tenant) throw new Error("No Xero organisation found");

    const expiryTs = new Date(Date.now() + tokens.expires_in * 1000);

    await pool.query(
      `INSERT INTO xero_connections (restaurant_id, access_token, refresh_token, tenant_id, tenant_name, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (restaurant_id) DO UPDATE
       SET access_token=$2, refresh_token=$3, tenant_id=$4, tenant_name=$5, expires_at=$6, connected_at=NOW()`,
      [restaurantId, encrypt(tokens.access_token), encrypt(tokens.refresh_token), tenant.tenantId, tenant.tenantName, expiryTs]
    );

    // Close popup and notify parent
    res.send(`<script>window.opener?.postMessage({xero:'connected',tenant:${JSON.stringify(tenant.tenantName)}},${JSON.stringify(CLIENT_ORIGIN)});window.close();</script>`);

  } catch (err) {
    logger.error({ err }, "Xero callback error");
    res.send(`<script>window.opener?.postMessage({xero:'error',message:'Xero connection failed'},${JSON.stringify(CLIENT_ORIGIN)});window.close();</script>`);
  }
});

/* ── Connection status ───────────────────────────────────────────────────── */
router.get("/status", authenticate, requireAdmin, async (req, res, next) => {
  if (!XERO_CLIENT_ID) return res.json({ connected: false });
  try {
    const conn = await getConnection(req.restaurantId);
    if (!conn) return res.json({ connected: false });
    res.json({
      connected:    true,
      tenant_name:  conn.tenant_name,
      connected_at: conn.connected_at,
      expires_at:   conn.expires_at,
    });
  } catch (err) {
    // Table may not exist yet — treat as not connected
    if (err.code === "42P01") return res.json({ connected: false });
    next(err);
  }
});

/* ── Disconnect ──────────────────────────────────────────────────────────── */
router.delete("/disconnect", authenticate, requireAdmin, async (req, res, next) => {
  try {
    await pool.query(`DELETE FROM xero_connections WHERE restaurant_id=$1`, [req.restaurantId]);
    res.json({ message: "Xero disconnected" });
  } catch (err) { next(err); }
});

/* ── Fetch Xero employees (for mapping) ─────────────────────────────────── */
router.get("/employees", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const conn  = await getConnection(req.restaurantId);
    const token = await refreshIfNeeded(conn, req.restaurantId);

    const r = await fetch(
      `https://api.xero.com/payroll.xro/1.0/Employees`,
      { headers: { Authorization: `Bearer ${token}`, "Xero-Tenant-Id": conn.tenant_id, Accept: "application/json" } }
    );

    if (!r.ok) throw new Error("Failed to fetch Xero employees: " + await r.text());
    const data = await r.json();

    res.json((data.Employees || []).map(e => ({
      id:   e.EmployeeID,
      name: `${e.FirstName} ${e.LastName}`,
    })));
  } catch (err) { next(err); }
});

/* ── Fetch Xero Earnings Rates (for mapping to pay types) ───────────────── */
router.get("/earnings-rates", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const conn  = await getConnection(req.restaurantId);
    const token = await refreshIfNeeded(conn, req.restaurantId);

    const r = await fetch(
      `https://api.xero.com/payroll.xro/1.0/PayItems`,
      { headers: { Authorization: `Bearer ${token}`, "Xero-Tenant-Id": conn.tenant_id, Accept: "application/json" } }
    );

    if (!r.ok) throw new Error("Failed to fetch earnings rates: " + await r.text());
    const data = await r.json();

    const rates = (data.PayItems?.EarningsRates || []).map(r => ({
      id:   r.EarningsRateID,
      name: r.Name,
    }));

    res.json(rates);
  } catch (err) { next(err); }
});

/* ── Map staff → Xero employee ID ───────────────────────────────────────── */
router.put("/staff/:staffId/employee", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { xero_employee_id } = req.body;
    const result = await pool.query(
      `UPDATE staff SET xero_employee_id=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING id, name, xero_employee_id`,
      [xero_employee_id || null, req.params.staffId, req.restaurantId]
    );
    if (!result.rows.length) throw new Error("Staff not found");
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

/* ── Map pay type → Xero earnings rate ──────────────────────────────────── */
router.put("/pay-types/:id/earnings-rate", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { xero_earnings_rate_id } = req.body;
    const result = await pool.query(
      `UPDATE pay_types SET xero_earnings_rate_id=$1 WHERE id=$2 AND restaurant_id=$3 RETURNING *`,
      [xero_earnings_rate_id || null, req.params.id, req.restaurantId]
    );
    if (!result.rows.length) throw new Error("Pay type not found");
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

/* ── Debug: check token scopes ───────────────────────────────────────────── */
router.get("/debug-scopes", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const conn  = await getConnection(req.restaurantId);
    const token = await refreshIfNeeded(conn, req.restaurantId);

    // Decode JWT payload without verifying (just to inspect claims)
    const parts = token.split(".");
    const payload = parts.length === 3 ? JSON.parse(Buffer.from(parts[1], "base64url").toString()) : null;

    // Also test the PayRunCalendars endpoint directly and report status
    const calRes = await fetch("https://api.xero.com/payroll.xro/1.0/PayRunCalendars", {
      headers: { Authorization: `Bearer ${token}`, "Xero-Tenant-Id": conn.tenant_id, Accept: "application/json" },
    });
    const calBody = await calRes.text();

    res.json({
      token_scopes: payload?.scope || payload?.scopes || "not in token payload",
      pay_calendars_status: calRes.status,
      pay_calendars_body: calBody.slice(0, 500),
      tenant_id: conn.tenant_id,
    });
  } catch (err) { next(err); }
});

/* ── Auto-setup: assign pay run calendar to all mapped employees ─────────── */
router.post("/setup-employees", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const conn  = await getConnection(req.restaurantId);
    const token = await refreshIfNeeded(conn, req.restaurantId);

    // 1. Get all mapped staff
    const staffRes = await pool.query(
      `SELECT id, name, xero_employee_id FROM staff WHERE restaurant_id=$1 AND xero_employee_id IS NOT NULL`,
      [req.restaurantId]
    );
    if (staffRes.rows.length === 0) throw new Error("No staff mapped to Xero employees. Map staff first.");

    // 2. Fetch Xero employee records to find one that already has a PayRunCalendarID
    const xeroEmpRes = await fetch("https://api.xero.com/payroll.xro/1.0/Employees", {
      headers: { Authorization: `Bearer ${token}`, "Xero-Tenant-Id": conn.tenant_id, Accept: "application/json" },
    });
    if (!xeroEmpRes.ok) throw new Error("Failed to fetch Xero employees: " + await xeroEmpRes.text());
    const xeroEmpData = await xeroEmpRes.json();

    // Build map of xeroEmployeeId → PayRunCalendarID (only for those that have one)
    const calendarByEmp = {};
    for (const emp of (xeroEmpData.Employees || [])) {
      if (emp.PayRunCalendarID) calendarByEmp[emp.EmployeeID] = emp.PayRunCalendarID;
    }

    // Find the first calendar ID from any of our mapped employees
    let calendarId = null;
    for (const staff of staffRes.rows) {
      if (calendarByEmp[staff.xero_employee_id]) {
        calendarId = calendarByEmp[staff.xero_employee_id];
        break;
      }
    }

    if (!calendarId) {
      throw new Error(
        "No pay frequency assigned to any employee yet. " +
        "In Xero: Payroll → Employees → click any ONE employee → Employment tab → set Pay Frequency to 'Weekly' → Save. " +
        "Then re-run Fix Setup here — it will copy that calendar to all other employees automatically."
      );
    }

    // 3. Assign that calendar to all mapped employees that don't have one yet
    const results = [];
    for (const staff of staffRes.rows) {
      if (calendarByEmp[staff.xero_employee_id]) {
        results.push({ name: staff.name, ok: true, note: "already set" });
        continue;
      }

      const updateRes = await fetch(
        `https://api.xero.com/payroll.xro/1.0/Employees/${staff.xero_employee_id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, "Xero-Tenant-Id": conn.tenant_id,
            "Content-Type": "application/json", Accept: "application/json",
          },
          body: JSON.stringify([{ EmployeeID: staff.xero_employee_id, PayRunCalendarID: calendarId }]),
        }
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        results.push({ name: staff.name, ok: false, error: errText });
      } else {
        results.push({ name: staff.name, ok: true });
      }
    }

    const successCount = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok);

    res.json({
      calendarId,
      results,
      message: `Pay frequency assigned to ${successCount}/${results.length} employees${failed.length ? `. Failed: ${failed.map(r => r.name).join(", ")}` : ""}`,
    });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════════════════════
   SEND PAYROLL TO XERO
   POST /xero/send-payroll

   Body: {
     entries: [{ shift_id, staff_id, hours, rate, amount, date }],
     pay_period_start: "YYYY-MM-DD",
     pay_period_end:   "YYYY-MM-DD"
   }

   Logic:
   ► group entries by staff
   ► for each staff: find their xero_employee_id
   ► determine hours per day of the week for the pay period
   ► POST timesheet to Xero
   ► mark payroll_entries as paid (partial payment deducted already)
   ► the `amount` field ALREADY reflects remaining after cash payments
═══════════════════════════════════════════════════════════════════════════ */
router.post("/send-payroll", authenticate, requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { entries, pay_period_start, pay_period_end, batch_id } = req.body;
    const { restaurantId, userId } = req;

    if (!Array.isArray(entries) || entries.length === 0) throw new Error("No entries provided");
    if (!pay_period_start || !pay_period_end) throw new Error("pay_period_start and pay_period_end required");

    const conn  = await getConnection(restaurantId);
    const token = await refreshIfNeeded(conn, restaurantId);

    // ── Group entries by staff ──────────────────────────────────────────
    const byStaff = {};
    for (const e of entries) {
      if (!byStaff[e.staff_id]) byStaff[e.staff_id] = [];
      byStaff[e.staff_id].push(e);
    }

    // ── Fetch staff Xero IDs + pay type Xero earnings rate IDs ─────────
    const staffIds    = Object.keys(byStaff).map(Number);
    const staffRes    = await client.query(
      `SELECT id, name, xero_employee_id FROM staff WHERE id = ANY($1) AND restaurant_id=$2`,
      [staffIds, restaurantId]
    );
    const staffMap = Object.fromEntries(staffRes.rows.map(s => [s.id, s]));

    const payTypeIds  = [...new Set(entries.map(e => e.pay_type_id).filter(Boolean))];
    const ptRes       = await client.query(
      `SELECT id, xero_earnings_rate_id, base_rate FROM pay_types WHERE id = ANY($1)`,
      [payTypeIds.length ? payTypeIds : [0]]
    );
    const ptMap = Object.fromEntries(ptRes.rows.map(p => [p.id, p]));

    // Build week days array (Mon–Sun order matching Xero AU payroll)
    const weekDays = [];
    let d = new Date(pay_period_start + "T00:00:00");
    const endD = new Date(pay_period_end + "T00:00:00");
    while (d <= endD) {
      weekDays.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }

    // ── Build Xero timesheets ────────────────────────────────────────────
    const timesheets = [];
    const unmapped   = [];

    for (const [staffIdStr, staffEntries] of Object.entries(byStaff)) {
      const staffId = Number(staffIdStr);
      const staff   = staffMap[staffId];

      if (!staff?.xero_employee_id) {
        unmapped.push(staff?.name || `Staff ${staffId}`);
        continue;
      }

      // Build hours-per-day per earnings rate
      const rateLines = {}; // earningsRateId → { [date]: hours }

      for (const e of staffEntries) {
        const pt = ptMap[e.pay_type_id];
        const earningsRateId = pt?.xero_earnings_rate_id;
        if (!earningsRateId) continue;

        if (!rateLines[earningsRateId]) rateLines[earningsRateId] = {};
        const dateKey = e.date;
        rateLines[earningsRateId][dateKey] = (rateLines[earningsRateId][dateKey] || 0) + e.hours;
      }

      const timesheetLines = Object.entries(rateLines).map(([earningsRateId, hoursPerDay]) => ({
        EarningsRateID: earningsRateId,
        // NumberOfUnits: array matching week days
        NumberOfUnits: weekDays.map(day => Number((hoursPerDay[day] || 0).toFixed(2))),
      }));

      if (timesheetLines.length === 0) continue;

      // Xero date format: /Date(ms+0000)/
      const startMs = new Date(pay_period_start + "T00:00:00Z").getTime();
      const endMs   = new Date(pay_period_end   + "T00:00:00Z").getTime();

      timesheets.push({
        EmployeeID:    staff.xero_employee_id,
        StartDate:     `/Date(${startMs}+0000)/`,
        EndDate:       `/Date(${endMs}+0000)/`,
        Status:        "Draft",
        TimesheetLines: timesheetLines,
      });
    }

    if (unmapped.length > 0 && timesheets.length === 0) {
      throw new Error(`No staff mapped to Xero employees: ${unmapped.join(", ")}. Map them in Staff → Xero Employee first.`);
    }

    // ── POST to Xero ─────────────────────────────────────────────────────
    const xeroRes = await fetch("https://api.xero.com/payroll.xro/1.0/Timesheets", {
      method:  "POST",
      headers: {
        Authorization:    `Bearer ${token}`,
        "Xero-Tenant-Id": conn.tenant_id,
        "Content-Type":   "application/json",
        Accept:           "application/json",
      },
      body: JSON.stringify(timesheets),
    });

    if (!xeroRes.ok) {
      const errText = await xeroRes.text();
      throw new Error(`Xero API error: ${errText}`);
    }

    const xeroData = await xeroRes.json();
    const xeroTimesheetIds = (xeroData.Timesheets || []).map(t => t.TimesheetID);

    // ── Record payroll in DB (mark as paid since sent to Xero) ───────────
    await client.query("BEGIN");

    let activeBatchId = batch_id;
    if (!activeBatchId) {
      const batchRes = await client.query(
        `INSERT INTO payroll_batches (restaurant_id, status, payment_method, created_by, xero_timesheet_ids)
         VALUES ($1,'paid','xero',$2,$3) RETURNING id`,
        [restaurantId, userId, JSON.stringify(xeroTimesheetIds)]
      );
      activeBatchId = batchRes.rows[0].id;
    } else {
      await client.query(
        `UPDATE payroll_batches SET status='paid', xero_timesheet_ids=$1 WHERE id=$2`,
        [JSON.stringify(xeroTimesheetIds), activeBatchId]
      );
    }

    for (const e of entries) {
      const staff = staffMap[e.staff_id];
      if (!staff?.xero_employee_id) continue; // skip unmapped

      await client.query(
        `INSERT INTO payroll_entries
           (batch_id, restaurant_id, shift_id, staff_id, hours, rate, amount, status, payment_method, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'paid','xero',NOW())`,
        [activeBatchId, restaurantId, e.shift_id, e.staff_id, e.hours, e.rate, e.amount]
      );
    }

    await client.query("COMMIT");

    res.json({
      message:     `Sent ${timesheets.length} timesheets to Xero${unmapped.length ? `. Warning: ${unmapped.join(", ")} not mapped.` : ""}`,
      timesheet_ids: xeroTimesheetIds,
      unmapped,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/* ── List Xero Deduction Types (from PayItems) ───────────────────────────── */
router.get("/deduction-types", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const conn  = await getConnection(req.restaurantId);
    const token = await refreshIfNeeded(conn, req.restaurantId);

    const r = await fetch(
      "https://api.xero.com/payroll.xro/1.0/PayItems",
      { headers: { Authorization: `Bearer ${token}`, "Xero-Tenant-Id": conn.tenant_id, Accept: "application/json" } }
    );
    if (!r.ok) throw new Error("Failed to fetch pay items: " + await r.text());
    const data = await r.json();

    const types = (data.PayItems?.DeductionTypes || []).map(d => ({
      id:   d.DeductionTypeID,
      name: d.Name,
    }));

    res.json({ types, saved_id: conn.advance_deduction_type_id || null });
  } catch (err) { next(err); }
});

/* ── Save chosen advance deduction type ─────────────────────────────────── */
router.put("/advance-deduction-type", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { deduction_type_id } = req.body;
    await pool.query(
      `UPDATE xero_connections SET advance_deduction_type_id=$1 WHERE restaurant_id=$2`,
      [deduction_type_id || null, req.restaurantId]
    );
    res.json({ message: "Saved" });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY ADVANCE DEDUCTIONS TO OPEN PAY RUN
   POST /xero/apply-advance-deductions
   Body: { advances: [{ staff_id, amount }] }

   Finds the current DRAFT pay run, adds a deduction line to each staff's
   payslip for the advance amount using the configured deduction type.
═══════════════════════════════════════════════════════════════════════════ */
router.post("/apply-advance-deductions", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { advances } = req.body;
    if (!Array.isArray(advances) || advances.length === 0) throw new Error("No advances provided");

    const conn  = await getConnection(req.restaurantId);
    const token = await refreshIfNeeded(conn, req.restaurantId);

    if (!conn.advance_deduction_type_id) {
      throw new Error("No deduction type configured. Select one in the payroll panel first.");
    }

    // Resolve staff → Xero employee IDs
    const staffIds = advances.map(a => a.staff_id);
    const staffRes = await pool.query(
      `SELECT id, xero_employee_id FROM staff WHERE id = ANY($1) AND restaurant_id=$2`,
      [staffIds, req.restaurantId]
    );
    const staffXeroMap = Object.fromEntries(
      staffRes.rows.filter(s => s.xero_employee_id).map(s => [s.id, s.xero_employee_id])
    );

    // Fetch draft pay runs from Xero
    const prRes = await fetch(
      "https://api.xero.com/payroll.xro/1.0/PayRuns?status=DRAFT",
      { headers: { Authorization: `Bearer ${token}`, "Xero-Tenant-Id": conn.tenant_id, Accept: "application/json" } }
    );
    if (!prRes.ok) throw new Error("Failed to fetch pay runs: " + await prRes.text());
    const prData = await prRes.json();
    const payRuns = prData.PayRuns || [];

    if (payRuns.length === 0) {
      throw new Error("No open pay run found in Xero. Approve the timesheets and let Xero generate the pay run first.");
    }

    // Use most recent draft pay run
    const payRun  = payRuns[0];
    const payslipByEmployee = Object.fromEntries(
      (payRun.Payslips || []).map(p => [p.EmployeeID, p])
    );

    const results = [];
    for (const adv of advances) {
      const xeroEmpId = staffXeroMap[adv.staff_id];
      if (!xeroEmpId) {
        results.push({ staff_id: adv.staff_id, ok: false, error: "Not mapped to Xero" });
        continue;
      }

      const payslip = payslipByEmployee[xeroEmpId];
      if (!payslip) {
        results.push({ staff_id: adv.staff_id, ok: false, error: "No payslip in current pay run" });
        continue;
      }

      const upRes = await fetch(
        `https://api.xero.com/payroll.xro/1.0/Payslip/${payslip.PayslipID}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, "Xero-Tenant-Id": conn.tenant_id,
            "Content-Type": "application/json", Accept: "application/json",
          },
          body: JSON.stringify([{
            PayslipID: payslip.PayslipID,
            DeductionLines: [{
              DeductionTypeID: conn.advance_deduction_type_id,
              Amount: Number(adv.amount.toFixed(2)),
              Description: "Cash Advance Repayment",
            }],
          }]),
        }
      );

      if (!upRes.ok) {
        results.push({ staff_id: adv.staff_id, ok: false, error: await upRes.text() });
      } else {
        results.push({ staff_id: adv.staff_id, ok: true, amount: adv.amount });
      }
    }

    const ok     = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);

    res.json({
      message: `Deductions applied for ${ok.length}/${advances.length} employees${
        failed.length ? `. Issues: ${failed.map(r => r.error).join("; ")}` : ""
      }`,
      pay_run_id: payRun.PayRunID,
      results,
    });
  } catch (err) { next(err); }
});

export default router;
