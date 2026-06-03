import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePayrollSummary, useRecordPayroll, usePayrollBatches, useUpdatePayTypeRates, useAdvances, useDeleteAdvance } from "@/hooks/use-payroll";
import { useSendPayrollToXero, useXeroSetupEmployees, useXeroDeductionTypes, useSaveAdvanceDeductionType, useApplyAdvanceDeductions } from "@/hooks/use-xero";
import { usePayTypes } from "@/hooks/use-roster";
import { useSettings } from "@/hooks/use-settings";
import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import dayjs from "dayjs";
import {
  ChevronLeft, ChevronRight, CheckSquare, Square,
  Banknote, Building2, Send, Clock, Settings2,
  CalendarCheck, DollarSign, Users, History, Receipt, Wrench,
  AlertCircle, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, symbol: string) {
  return `${symbol}${n.toFixed(2)}`;
}

function fmtHours(h: number) {
  if (!h) return "–";
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  return min > 0 ? `${hr}h ${min}m` : `${hr}h`;
}

// ── Pay Rate Settings Dialog ──────────────────────────────────────────────────

function RatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: payTypes = [] } = usePayTypes();
  const { mutate: updateRates, isPending } = useUpdatePayTypeRates();
  const [editing, setEditing] = useState<Record<number, any>>({});

  const save = (id: number) => {
    const vals = editing[id] || {};
    updateRates({
      id,
      weekday_rate: vals.weekday_rate !== "" ? Number(vals.weekday_rate) : undefined,
      weekend_rate: vals.weekend_rate !== "" ? Number(vals.weekend_rate) : undefined,
      holiday_rate: vals.holiday_rate !== "" ? Number(vals.holiday_rate) : undefined,
    }, { onSuccess: () => setEditing(prev => { const n = {...prev}; delete n[id]; return n; }) });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Pay Rate Settings
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground mb-3">
          Set weekday / weekend rates per pay type. Leave blank to use the base rate.
        </p>
        <div className="space-y-4">
          {(payTypes as any[]).map((pt: any) => {
            const e = editing[pt.id] || {};
            const change = (key: string, val: string) =>
              setEditing(prev => ({ ...prev, [pt.id]: { ...pt, ...prev[pt.id], [key]: val } }));
            return (
              <div key={pt.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{pt.name}</p>
                  <span className="text-xs text-muted-foreground">Base: ${Number(pt.base_rate).toFixed(2)}/hr</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "weekday_rate", label: "Weekday" },
                    { key: "weekend_rate", label: "Weekend" },
                    { key: "holiday_rate", label: "Holiday" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground">{label} $/hr</label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder={String(Number(pt.base_rate).toFixed(2))}
                        value={e[key] ?? (pt[key] != null ? pt[key] : "")}
                        onChange={ev => change(key, ev.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
                {editing[pt.id] && (
                  <Button size="sm" className="w-full h-7 text-xs" onClick={() => save(pt.id)} disabled={isPending}>
                    Save {pt.name}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Payroll() {
  const { data: settings } = useSettings();
  const { format, symbol } = useCurrency();
  const isAUD = settings?.currency_code === "AUD";
  const payrollEnabled = settings?.use_payroll ?? false;

  const [weekStart, setWeekStart] = useState(
    dayjs().startOf("week").add(1, "day").format("YYYY-MM-DD")
  );
  const weekEnd = dayjs(weekStart).add(6, "day").format("YYYY-MM-DD");

  const [mode, setMode] = useState<"roster" | "actual">("roster");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payMethod, setPayMethod] = useState<"cash" | "bank" | "xero">("cash");
  const [notes, setNotes] = useState("");
  const [ratesOpen, setRatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [advancesOpen, setAdvancesOpen] = useState(false);

  const { data: entries = [], isLoading } = usePayrollSummary(weekStart, weekEnd, mode);
  const { data: batches = [] } = usePayrollBatches();
  const { data: allAdvances = [] } = useAdvances();
  const { mutate: recordPayment, isPending: payingCash } = useRecordPayroll();
  const { mutate: sendToXero, isPending: payingXero } = useSendPayrollToXero();
  const { mutate: setupXeroEmployees, isPending: settingUpXero } = useXeroSetupEmployees();
  const { mutate: deleteAdvance } = useDeleteAdvance();
  const { data: deductionData } = useXeroDeductionTypes(payMethod === "xero");
  const { mutate: saveDeductionType } = useSaveAdvanceDeductionType();
  const { mutate: applyDeductions, isPending: applyingDeductions } = useApplyAdvanceDeductions();
  const paying = payingCash || payingXero;


  const key = (e: any) => `${e.shift_id}_${e.staff_id}`;

  const toggleSelect = (e: any) => {
    const k = key(e);
    setSelected(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  const unpaidEntries = (entries as any[]).filter(e => e.remaining > 0);
  const allSelected = unpaidEntries.length > 0 && unpaidEntries.every(e => selected.has(key(e)));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unpaidEntries.map(key)));
    }
  };

  const selectedEntries = (entries as any[]).filter(e => selected.has(key(e)));
  const totalGross = selectedEntries.reduce((s, e) => s + e.remaining, 0);
  const totalHours = selectedEntries.reduce((s, e) => s + e.hours, 0);

  // Per-staff net: gross remaining minus outstanding advance (capped at gross, min 0)
  const staffNetMap = useMemo(() => {
    const map: Record<number, { name: string; gross: number; advance: number; net: number }> = {};
    for (const e of selectedEntries) {
      if (!map[e.staff_id]) {
        map[e.staff_id] = { name: e.staff_name, gross: 0, advance: e.outstanding_advance || 0, net: 0 };
      }
      map[e.staff_id].gross += e.remaining;
    }
    for (const v of Object.values(map)) {
      v.net = Math.max(0, v.gross - v.advance);
    }
    return map;
  }, [selectedEntries]);

  const totalAdvanceSettled = Object.values(staffNetMap).reduce((s, v) => s + Math.min(v.advance, v.gross), 0);
  const totalNet = totalGross - totalAdvanceSettled;

  // Advance-aware entry builder: distributes deduction proportionally across shifts per staff
  const buildEntries = () =>
    selectedEntries.map(e => {
      const staffData = staffNetMap[e.staff_id];
      const ratio = staffData && staffData.gross > 0 ? staffData.net / staffData.gross : 1;
      return {
        shift_id: e.shift_id,
        staff_id: e.staff_id,
        pay_type_id: e.pay_type_id,
        hours: e.hours,
        rate: e.rate,
        amount: Number((e.remaining * ratio).toFixed(2)),
        date: e.date,
      };
    });

  // Advances with per-staff info for display
  const selectedAdvances = Object.entries(staffNetMap)
    .filter(([, v]) => v.advance > 0)
    .map(([id, v]) => ({ staff_id: Number(id), name: v.name, advance: Math.min(v.advance, v.gross) }));

  // Group entries by date
  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of entries as any[]) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [entries]);

  const handlePay = () => {
    if (selectedEntries.length === 0) return;

    const onSuccess = () => {
      setSelected(new Set());
      setNotes("");
    };

    const builtEntries = buildEntries();

    if (payMethod === "xero") {
      sendToXero({
        entries: builtEntries,
        pay_period_start: weekStart,
        pay_period_end: weekEnd,
        notes: notes.trim() || undefined,
      }, { onSuccess });
    } else {
      recordPayment({
        entries: builtEntries,
        payment_method: payMethod,
        notes: notes.trim() || undefined,
      }, { onSuccess });
    }
  };

  if (!payrollEnabled || !isAUD) {
    return (
      <div className="flex bg-background min-h-screen pt-16 lg:pt-0">
        <Sidebar />
        <main className="flex-1 lg:ml-60 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold mb-1">Payroll not enabled</h2>
            <p className="text-sm text-muted-foreground">
              {!isAUD
                ? "Payroll is available for AUD businesses only."
                : "Enable payroll in Settings → Payroll to get started."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex bg-background min-h-screen pt-16 lg:pt-0">
      <Sidebar />
      <RatesDialog open={ratesOpen} onClose={() => setRatesOpen(false)} />

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" /> Payment History
            </DialogTitle>
          </DialogHeader>
          <div className="divide-y max-h-96 overflow-y-auto">
            {(batches as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded yet.</p>
            )}
            {(batches as any[]).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium capitalize">{b.payment_method}</p>
                  <p className="text-xs text-muted-foreground">
                    {dayjs(b.created_at).format("D MMM YYYY h:mm A")} · {b.entry_count} shifts
                  </p>
                  {b.notes && <p className="text-xs text-muted-foreground">{b.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-semibold">{fmt(Number(b.total_amount), symbol)}</p>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    b.status === "paid"
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                  )}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Advances Dialog — view only; create from Staff page */}
      <Dialog open={advancesOpen} onOpenChange={setAdvancesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Outstanding Advances
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">Record advances from the Staff page.</p>
          <div className="divide-y max-h-80 overflow-y-auto">
            {(allAdvances as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No outstanding advances.</p>
            )}
            {(allAdvances as any[]).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium">{a.staff_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    {a.notes && ` · ${a.notes}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-600">{fmt(Number(a.amount), symbol)}</span>
                  <button
                    onClick={() => deleteAdvance(a.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                    title="Cancel advance"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <main className="flex-1 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-primary shrink-0" />
              Payroll
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Shift-based payroll · AUD</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setAdvancesOpen(true)}>
              <Banknote className="w-4 h-4 mr-1" /> Advances
              {(allAdvances as any[]).length > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {(allAdvances as any[]).length}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="w-4 h-4 mr-1" /> History
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRatesOpen(true)}>
              <Settings2 className="w-4 h-4 mr-1" /> Rates
            </Button>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          {/* Week navigator */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(dayjs(weekStart).subtract(7, "day").format("YYYY-MM-DD"))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[190px] text-center">
              {dayjs(weekStart).format("D MMM")} – {dayjs(weekEnd).format("D MMM YYYY")}
            </span>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(dayjs(weekStart).add(7, "day").format("YYYY-MM-DD"))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-border/60 overflow-hidden text-sm">
            <button
              onClick={() => setMode("roster")}
              className={cn("px-3 py-1.5 transition-colors", mode === "roster" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted/50")}
            >
              Roster hours
            </button>
            <button
              onClick={() => setMode("actual")}
              className={cn("px-3 py-1.5 transition-colors", mode === "actual" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted/50")}
            >
              Actual hours
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Users, label: "Staff", value: String(new Set((entries as any[]).map((e: any) => e.staff_id)).size) },
            { icon: Clock, label: "Total Hours", value: fmtHours((entries as any[]).reduce((s, e: any) => s + e.hours, 0)) },
            { icon: DollarSign, label: "Gross", value: fmt((entries as any[]).reduce((s, e: any) => s + e.gross_amount, 0), symbol) },
            { icon: CalendarCheck, label: "Unpaid", value: fmt((entries as any[]).reduce((s, e: any) => s + e.remaining, 0), symbol) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="w-3.5 h-3.5" /> {label}</p>
              <p className="text-xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden mb-6">

          {/* Table header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/40">
            <button onClick={toggleAll} className="text-muted-foreground hover:text-primary">
              {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            <div className="grid grid-cols-[2fr_80px_80px_70px_80px_80px_80px] flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Staff / Shift</span>
              <span>Date</span>
              <span>Pay Type</span>
              <span>Hours</span>
              <span>Rate</span>
              <span>Gross</span>
              <span>Remaining</span>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Loading payroll data…
            </div>
          )}

          {!isLoading && Object.keys(byDate).length === 0 && (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              No shifts found for this period.
            </div>
          )}

          {!isLoading && Object.entries(byDate).map(([date, dayEntries]) => (
            <div key={date}>
              {/* Day header */}
              <div className="px-4 py-2 bg-muted/30 border-b text-xs font-semibold text-muted-foreground">
                {dayjs(date).format("dddd, D MMM YYYY")}
                <span className={cn("ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium",
                  dayjs(date).day() === 0 || dayjs(date).day() === 6
                    ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    : "bg-muted text-muted-foreground"
                )}>
                  {dayjs(date).day() === 0 || dayjs(date).day() === 6 ? "Weekend" : "Weekday"}
                </span>
              </div>

              {/* Entries for this day */}
              {(dayEntries as any[]).map((e: any) => {
                const k = key(e);
                const isSel = selected.has(k);
                const isPaid = e.remaining <= 0;
                return (
                  <div
                    key={k}
                    onClick={() => !isPaid && toggleSelect(e)}
                    className={`flex items-center gap-2 px-4 py-3 border-b last:border-0 transition-colors ${
                      isPaid ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"
                    } ${isSel ? "bg-primary/5" : ""}`}
                  >
                    <div className="text-muted-foreground">
                      {isPaid
                        ? <CheckSquare className="w-4 h-4 text-green-500" />
                        : isSel
                          ? <CheckSquare className="w-4 h-4 text-primary" />
                          : <Square className="w-4 h-4" />}
                    </div>
                    <div className="grid grid-cols-[2fr_80px_80px_70px_80px_80px_80px] flex-1 text-sm items-center">
                      <div>
                        <span className="font-medium">{e.staff_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {e.shift_start}–{e.shift_end}
                        </span>
                        {mode === "actual" && !e.clocked_in && (
                          <span className="ml-2 text-[10px] text-orange-500">no clock-in</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{dayjs(date).format("D MMM")}</span>
                      <span className="text-xs">{e.pay_type_name}</span>
                      <span className="text-xs font-medium">{fmtHours(e.hours)}</span>
                      <span className="text-xs text-muted-foreground">{symbol}{Number(e.rate).toFixed(2)}/h</span>
                      <span className="text-xs">{fmt(e.gross_amount, symbol)}</span>
                      <span className={`text-xs font-semibold ${isPaid ? "text-green-600" : "text-primary"}`}>
                        {isPaid ? "Paid" : fmt(e.remaining, symbol)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Pay panel ── */}
        {selectedEntries.length > 0 && (
          <div className="fixed bottom-0 left-0 lg:left-60 right-0 bg-card border-t border-border/60 shadow-lg px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 z-30">
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {selectedEntries.length} shift{selectedEntries.length !== 1 ? "s" : ""} · {fmtHours(totalHours)}
                {totalAdvanceSettled > 0 ? (
                  <>
                    {" "}· <span className="text-muted-foreground line-through">{fmt(totalGross, symbol)}</span>
                    {" "}<span className="text-amber-600 dark:text-amber-400 text-xs">−{fmt(totalAdvanceSettled, symbol)} adv</span>
                    {" "}= <span className="text-primary">{fmt(totalNet, symbol)}</span>
                  </>
                ) : (
                  <> · <span className="text-primary">{fmt(totalGross, symbol)}</span></>
                )}
              </p>
              {selectedAdvances.length > 0 && (
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                  Advance deducted: {selectedAdvances.map(a => `${a.name.split(" ")[0]} −${fmt(a.advance, symbol)}`).join(", ")}
                </p>
              )}
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-2 h-8 text-xs max-w-xs"
              />
            </div>

            {/* Method + Pay button */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Payment method selector */}
              <div className="flex rounded-xl border border-border/60 overflow-hidden text-xs">
                {[
                  { val: "cash", icon: Banknote, label: "Cash" },
                  { val: "bank", icon: Building2, label: "Bank" },
                  { val: "xero", icon: Send, label: "Xero" },
                ].map(({ val, icon: Icon, label }) => (
                  <button
                    key={val}
                    onClick={() => setPayMethod(val as any)}
                    className={cn("flex items-center gap-1 px-3 py-2 transition-colors",
                      payMethod === val ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>

              {payMethod === "xero" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setupXeroEmployees()}
                  disabled={settingUpXero}
                  title="Assign pay run calendars to all Xero-mapped employees"
                >
                  <Wrench className="w-3.5 h-3.5 mr-1" />
                  {settingUpXero ? "Setting up…" : "Fix Setup"}
                </Button>
              )}

              {/* Advance deductions via Xero */}
              {payMethod === "xero" && totalAdvanceSettled > 0 && (
                <>
                  {/* Deduction type picker (one-time setup) */}
                  {deductionData && (
                    <select
                      className="border rounded-lg px-2 py-1.5 text-xs bg-background max-w-[160px]"
                      value={deductionData.saved_id ?? ""}
                      onChange={e => e.target.value && saveDeductionType(e.target.value)}
                      title="Xero deduction type for advance repayment"
                    >
                      <option value="">Select deduction type…</option>
                      {deductionData.types.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}

                  {/* Apply to open pay run */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={applyingDeductions || !deductionData?.saved_id}
                    title={!deductionData?.saved_id ? "Select a deduction type first" : "Apply advance deductions to the current Xero pay run"}
                    onClick={() =>
                      applyDeductions(
                        selectedAdvances.map(a => ({ staff_id: a.staff_id, amount: a.advance }))
                      )
                    }
                  >
                    {applyingDeductions ? "Applying…" : `Apply −${fmt(totalAdvanceSettled, symbol)} to Pay Run`}
                  </Button>
                </>
              )}

              <Button onClick={handlePay} disabled={paying} className="gap-2">
                {paying ? "Processing…" : `Pay ${fmt(totalNet, symbol)}`}
              </Button>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
