import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useShiftLogs } from "@/hooks/use-roster";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, MapPin, Clock, CheckCircle2, AlertCircle, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt12(iso?: string) {
  if (!iso) return "–";
  return dayjs(iso).format("h:mm A");
}

function fmtDuration(inIso?: string, outIso?: string): string {
  if (!inIso || !outIso) return "–";
  const mins = dayjs(outIso).diff(dayjs(inIso), "minute");
  if (mins <= 0) return "–";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// returns how many minutes late clock-in was (negative = early)
function latenessMinutes(clockIn?: string, shiftStart?: string, shiftDate?: string): number | null {
  if (!clockIn || !shiftStart || !shiftDate) return null;
  const dateStr = dayjs(shiftDate).format("YYYY-MM-DD");
  const scheduled = dayjs(`${dateStr}T${shiftStart}`);
  return dayjs(clockIn).diff(scheduled, "minute");
}

type StatusInfo = { label: string; color: string; icon: React.ReactNode };

function statusInfo(log: any): StatusInfo {
  if (!log.clock_in) {
    return { label: "Absent", color: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400", icon: <AlertCircle className="w-3.5 h-3.5" /> };
  }
  if (!log.clock_out) {
    return { label: "Working", color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300", icon: <Timer className="w-3.5 h-3.5" /> };
  }
  const late = latenessMinutes(log.clock_in, log.shift_start, log.date);
  if (late === null) return { label: "Clocked", color: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
  if (late > 15) return { label: `${late}m late`, color: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300", icon: <AlertCircle className="w-3.5 h-3.5" /> };
  if (late < -5) return { label: "Early", color: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
  return { label: "On time", color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
}

// ── Timeline bar ──────────────────────────────────────────────────────────────

function TimelineBar({ log }: { log: any }) {
  const dateStr = log.date ? dayjs(log.date).format("YYYY-MM-DD") : null;
  if (!dateStr || !log.shift_start || !log.shift_end) return null;

  const shiftStart = dayjs(`${dateStr}T${log.shift_start}`);
  const shiftEnd   = dayjs(`${dateStr}T${log.shift_end}`);
  const total      = shiftEnd.diff(shiftStart, "minute");
  if (total <= 0) return null;

  // Extend window slightly for display
  const windowStart = shiftStart.subtract(30, "minute");
  const windowEnd   = shiftEnd.add(30, "minute");
  const windowTotal = windowEnd.diff(windowStart, "minute");

  const pct = (start: dayjs.Dayjs, end: dayjs.Dayjs) => ({
    left:  `${Math.max(0, (start.diff(windowStart, "minute") / windowTotal) * 100).toFixed(1)}%`,
    width: `${Math.min(100, (end.diff(start, "minute") / windowTotal) * 100).toFixed(1)}%`,
  });

  const shiftPct  = pct(shiftStart, shiftEnd);

  let clockedPct: { left: string; width: string } | null = null;
  if (log.clock_in) {
    const ci = dayjs(log.clock_in);
    const co = log.clock_out ? dayjs(log.clock_out) : dayjs(); // live: use now
    clockedPct = pct(ci, co);
  }

  return (
    <div className="relative w-full h-5 bg-muted rounded-full overflow-hidden mt-1">
      {/* Scheduled shift */}
      <div
        className="absolute top-0 h-full rounded-full bg-blue-200"
        style={{ left: shiftPct.left, width: shiftPct.width }}
      />
      {/* Actual clocked time */}
      {clockedPct && (
        <div
          className={`absolute top-0 h-full rounded-full opacity-80 ${log.clock_out ? "bg-green-500" : "bg-green-400 animate-pulse"}`}
          style={{ left: clockedPct.left, width: clockedPct.width }}
        />
      )}
      {/* Time labels */}
      <span className="absolute left-1 top-0 text-[9px] text-gray-500 leading-5 select-none">
        {shiftStart.format("H:mm")}
      </span>
      <span className="absolute right-1 top-0 text-[9px] text-gray-500 leading-5 select-none">
        {shiftEnd.format("H:mm")}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendanceLogs() {
  const [weekStart, setWeekStart] = useState(
    dayjs().startOf("week").add(1, "day").format("YYYY-MM-DD")
  );
  const weekEnd = dayjs(weekStart).add(6, "day").format("YYYY-MM-DD");

  const { data: logs = [], isLoading } = useShiftLogs(weekStart, weekEnd);

  const prevWeek = () => setWeekStart(dayjs(weekStart).subtract(7, "day").format("YYYY-MM-DD"));
  const nextWeek = () => setWeekStart(dayjs(weekStart).add(7, "day").format("YYYY-MM-DD"));

  // Summary totals per staff
  const staffTotals: Record<string, number> = {};
  for (const log of logs as any[]) {
    const name = log.name ?? log.staff_name ?? "Unknown";
    if (log.clock_in && log.clock_out) {
      const h = dayjs(log.clock_out).diff(dayjs(log.clock_in), "minute") / 60;
      staffTotals[name] = (staffTotals[name] ?? 0) + h;
    }
  }

  const totalHours = Object.values(staffTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="flex bg-background min-h-screen pt-16 lg:pt-0">
      <Sidebar />

      <main className="flex-1 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
              <Clock className="w-6 h-6 text-primary shrink-0" />
              Attendance Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Clock-in &amp; clock-out records for all staff
            </p>
          </div>

          {/* Week navigator */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {dayjs(weekStart).format("D MMM")} – {dayjs(weekEnd).format("D MMM YYYY")}
            </span>
            <Button variant="outline" size="icon" onClick={nextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Total Shifts</p>
            <p className="text-2xl font-bold mt-1">{(logs as any[]).length}</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-bold mt-1">{totalHours.toFixed(1)}h</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Still Working</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {(logs as any[]).filter((l: any) => l.clock_in && !l.clock_out).length}
            </p>
          </div>
          <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Staff Worked</p>
            <p className="text-2xl font-bold mt-1">{Object.keys(staffTotals).length}</p>
          </div>
        </div>

        {/* ── Staff hours summary strip ── */}
        {Object.keys(staffTotals).length > 0 && (
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Hours This Week
            </p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(staffTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([name, hours]) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 bg-muted/50 border rounded-lg px-3 py-1.5"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {name[0]}
                    </div>
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-sm text-muted-foreground">{hours.toFixed(1)}h</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-8 h-2.5 rounded-full bg-blue-200" />
            Scheduled shift
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-8 h-2.5 rounded-full bg-green-500" />
            Actual clocked time
          </span>
        </div>

        {/* ── Main table ── */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">

          {/* Table header */}
          <div className="grid grid-cols-[1fr_90px_100px_90px_90px_70px_120px] gap-x-3 px-4 py-3 bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Staff / Timeline</span>
            <span>Date</span>
            <span>Scheduled</span>
            <span>Clock In</span>
            <span>Clock Out</span>
            <span>Duration</span>
            <span>Status</span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
              <Clock className="w-4 h-4 animate-spin" /> Loading attendance…
            </div>
          )}

          {!isLoading && (logs as any[]).length === 0 && (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No attendance records for this period.
            </div>
          )}

          {!isLoading && (logs as any[]).map((log: any, i: number) => {
            const name = log.name ?? log.staff_name ?? "Unknown";
            const status = statusInfo(log);
            const dateStr = log.date ? dayjs(log.date).format("ddd D MMM") : "–";
            const location = log.clock_in_location_text;

            return (
              <div
                key={i}
                className="grid grid-cols-[1fr_90px_100px_90px_90px_70px_120px] gap-x-3 px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors items-start"
              >
                {/* Name + timeline */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {name[0]}
                    </div>
                    <span className="font-medium text-sm truncate">{name}</span>
                  </div>
                  <TimelineBar log={log} />
                  {location && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      {location}
                    </p>
                  )}
                </div>

                {/* Date */}
                <span className="text-xs text-muted-foreground pt-1">{dateStr}</span>

                {/* Scheduled */}
                <span className="text-xs pt-1">
                  {log.shift_start?.slice(0, 5)} – {log.shift_end?.slice(0, 5)}
                </span>

                {/* Clock In */}
                <span className={`text-xs font-medium pt-1 ${log.clock_in ? "text-green-700" : "text-muted-foreground"}`}>
                  {fmt12(log.clock_in)}
                </span>

                {/* Clock Out */}
                <span className={`text-xs font-medium pt-1 ${log.clock_out ? "text-red-600" : log.clock_in ? "text-green-600" : "text-muted-foreground"}`}>
                  {log.clock_in && !log.clock_out ? "Working…" : fmt12(log.clock_out)}
                </span>

                {/* Duration */}
                <span className="text-xs pt-1 text-muted-foreground">
                  {fmtDuration(log.clock_in, log.clock_out)}
                </span>

                {/* Status badge */}
                <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit mt-0.5 ${status.color}`}>
                  {status.icon}
                  {status.label}
                </div>
              </div>
            );
          })}
        </div>

        </div>
      </main>
    </div>
  );
}
