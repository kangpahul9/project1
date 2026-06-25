import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  useMyShifts, useMyStatus, useClockIn, useClockOut,
} from "@/hooks/use-roster";
import { useAuthStore } from "@/hooks/use-auth";
import { format, parseISO } from "date-fns";
import {
  MapPin, Clock, CalendarDays, LogIn, LogOut, Loader2,
  AlertCircle, DollarSign, LayoutDashboard, Moon, Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastError } from "@/hooks/use-toast";
import {
  useCurrentBusinessDay, useCloseBusinessDay, useExpectedCash,
} from "@/hooks/use-business-days";
import { useRecountCash } from "@/hooks/use-cash";
import { useSettings } from "@/hooks/use-settings";
import { useCurrency, useDenominations } from "@/hooks/use-currency";
import { useTheme } from "@/hooks/use-theme";
import { DenominationSelector } from "@/components/DenominationSelector";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  const data = await res.json();
  return data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Geolocation not supported")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
  });
}

function mapsLink(placeId: string | null) {
  if (!placeId) return null;
  return `https://www.google.com/maps?q=${placeId}`;
}

function fmt12(time?: string) {
  if (!time) return "–";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function StaffDashboard() {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const { data: shifts, isLoading: shiftsLoading } = useMyShifts();
  const { data: status, isLoading: statusLoading } = useMyStatus();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const [locating, setLocating] = useState(false);

  const { data: settings } = useSettings();
  const { format: formatCurrency } = useCurrency();
  const denoms = useDenominations();
  const useBusinessDay = settings?.use_business_day ?? false;
  const { data: currentDay } = useCurrentBusinessDay(useBusinessDay);
  const { mutate: closeDay, isPending: isClosing } = useCloseBusinessDay();
  const { data: expectedData } = useExpectedCash(useBusinessDay);
  const { mutate: recountCash } = useRecountCash();

  const [closingBreakdown, setClosingBreakdown] = useState(() => denoms.map(d => ({ note: d, qty: 0 })));
  const [closingReason, setClosingReason] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [recountBreakdown, setRecountBreakdown] = useState(() => denoms.map(d => ({ note: d, qty: 0 })));
  const [recountOpen, setRecountOpen] = useState(false);

  const closingTotal = closingBreakdown.reduce((s, n) => s + n.note * n.qty, 0);
  const recountTotal = recountBreakdown.reduce((s, n) => s + n.note * n.qty, 0);
  const expectedCash = expectedData?.expectedCash ?? 0;
  const difference = closingTotal - expectedCash;
  const hasMismatch = Math.abs(difference) > 0.01;

  const today = format(new Date(), "yyyy-MM-dd");
  const upcoming = (shifts ?? []).filter(s => s.date >= today);
  const past = (shifts ?? []).filter(s => s.date < today);

  async function handleClockIn() {
    setLocating(true);
    try {
      let payload: { place_id?: string; location_text?: string } = {};
      try {
        const pos = await getCurrentPosition();
        const { latitude: lat, longitude: lon } = pos.coords;
        const locationText = await reverseGeocode(lat, lon);
        payload = { place_id: `${lat.toFixed(6)},${lon.toFixed(6)}`, location_text: locationText };
      } catch { /* geolocation denied — proceed without */ }
      await clockIn.mutateAsync(payload);
    } finally { setLocating(false); }
  }

  async function handleClockOut() {
    setLocating(true);
    try {
      let payload: { place_id?: string; location_text?: string } = {};
      try {
        const pos = await getCurrentPosition();
        const { latitude: lat, longitude: lon } = pos.coords;
        const locationText = await reverseGeocode(lat, lon);
        payload = { place_id: `${lat.toFixed(6)},${lon.toFixed(6)}`, location_text: locationText };
      } catch { /* geolocation denied — proceed without */ }
      await clockOut.mutateAsync(payload);
    } finally { setLocating(false); }
  }

  const onCloseDay = () => {
    if (hasMismatch && !closingReason.trim()) {
      toastError("Please explain the cash mismatch before closing.");
      return;
    }
    closeDay(
      { breakdown: closingBreakdown, total: closingTotal, reason: hasMismatch ? closingReason : null },
      {
        onSuccess: () => {
          setCloseDialogOpen(false);
          setClosingBreakdown(denoms.map(d => ({ note: d, qty: 0 })));
          setClosingReason("");
        },
      }
    );
  };

  const handleRecount = () => {
    if (!recountBreakdown.some(n => n.qty > 0)) { toastError("Please enter at least one denomination."); return; }
    recountCash(
      { breakdown: recountBreakdown },
      { onSuccess: () => { setRecountOpen(false); setRecountBreakdown(denoms.map(d => ({ note: d, qty: 0 }))); } }
    );
  };

  const isBusy = locating || clockIn.isPending || clockOut.isPending;

  return (
    <div className="flex bg-background min-h-screen pt-16 lg:pt-8">
      <Sidebar />
      <main className="flex-1 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
              <LayoutDashboard className="w-6 h-6 text-primary shrink-0" />
              My Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Welcome back, {user?.name}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="mt-1 flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted/50 transition-colors shrink-0"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">

          {/* ── Clock In / Out ── */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Attendance
            </h2>

            {statusLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading status…
              </div>
            ) : status?.clocked_in && status.log ? (
              <>
                <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4">
                  <p className="text-emerald-700 dark:text-emerald-300 font-medium text-sm mb-1">Clocked in</p>
                  <p className="text-emerald-800 dark:text-emerald-200 font-bold text-xl">
                    {format(parseISO(status.log.clock_in), "hh:mm a")}
                  </p>
                  <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                    Shift: {fmt12(status.log.shift_start)} – {fmt12(status.log.shift_end)}
                  </p>
                  {status.log.clock_in_location_text && (
                    <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1 flex items-start gap-1">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{status.log.clock_in_location_text}</span>
                    </p>
                  )}
                  {status.log.clock_in_place_id && (
                    <a
                      href={mapsLink(status.log.clock_in_place_id) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 dark:text-emerald-300 underline mt-1 inline-block"
                    >
                      View on Google Maps
                    </a>
                  )}
                </div>
                <Button onClick={handleClockOut} disabled={isBusy}
                  className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white">
                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Clock Out
                </Button>
              </>
            ) : (
              <>
                <div className="mb-4 rounded-xl bg-muted/50 border border-border/60 p-4 text-sm text-muted-foreground">
                  You are not clocked in.
                </div>
                <Button onClick={handleClockIn} disabled={isBusy} className="w-full gap-2">
                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Clock In
                </Button>
              </>
            )}
          </div>

          {/* ── Upcoming Shifts ── */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" /> Upcoming Shifts
            </h2>

            {shiftsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming shifts scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map(s => (
                  <li key={s.id}
                    className="flex items-start justify-between rounded-xl border border-border/60 p-3 text-sm">
                    <div>
                      <p className="font-medium">{format(parseISO(s.date), "EEE, dd MMM yyyy")}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {fmt12(s.shift_start)} – {fmt12(s.shift_end)}
                      </p>
                    </div>
                    {s.date === today && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
                        Today
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Close Day Card ── */}
          {useBusinessDay && currentDay && (
            <button
              onClick={() => setCloseDialogOpen(true)}
              className="bg-card border border-red-200 dark:border-red-800 rounded-2xl shadow-sm p-6 text-left hover:shadow-md hover:border-red-300 dark:hover:border-red-700 transition-all"
            >
              <h2 className="font-semibold text-base mb-1 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" /> Close Day
              </h2>
              <p className="text-sm text-muted-foreground">Finalise today's business day</p>
            </button>
          )}

          {/* ── Recount Cash Card ── */}
          {useBusinessDay && (
            <button
              onClick={() => setRecountOpen(true)}
              className="bg-card border border-border/60 rounded-2xl shadow-sm p-6 text-left hover:shadow-md hover:border-primary/20 transition-all"
            >
              <h2 className="font-semibold text-base mb-1 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Recount Cash
              </h2>
              <p className="text-sm text-muted-foreground">Recalculate drawer cash</p>
            </button>
          )}
        </div>

        {/* ── Past Shifts ── */}
        {past.length > 0 && (
          <div className="mt-5 bg-card border border-border/60 rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" /> Recent Shifts
            </h2>
            <ul className="space-y-2">
              {[...past].reverse().slice(0, 10).map(s => (
                <li key={s.id}
                  className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">
                    {format(parseISO(s.date), "EEE, dd MMM yyyy")}
                  </span>
                  <span className="font-medium">
                    {fmt12(s.shift_start)} – {fmt12(s.shift_end)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        </div>
      </main>

      {/* ── Close Day Dialog ── */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="w-full max-w-md md:max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Close Business Day</DialogTitle>
            <DialogDescription>Count physical cash in drawer before closing.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={closingBreakdown} setBreakdown={setClosingBreakdown} />
          </div>
          <div className="text-center text-xl font-bold mt-4">
            Closing Cash: {formatCurrency(closingTotal)}
          </div>
          <div className="text-center text-sm mt-1 text-muted-foreground">
            Expected: {formatCurrency(expectedCash)}
          </div>
          <div className={cn(
            "text-center font-semibold mt-1",
            hasMismatch ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            Difference: {formatCurrency(difference)}
          </div>
          {hasMismatch && (
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1 text-red-600 dark:text-red-400">
                Mismatch Reason (Required)
              </label>
              <textarea
                className="w-full border border-border rounded-xl p-2.5 text-sm bg-background resize-none"
                rows={2}
                value={closingReason}
                onChange={e => setClosingReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={onCloseDay} disabled={isClosing}>
              {isClosing ? "Closing…" : "Confirm Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Recount Cash Dialog ── */}
      <Dialog open={recountOpen} onOpenChange={setRecountOpen}>
        <DialogContent className="w-full max-w-md md:max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Recount Drawer Cash</DialogTitle>
            <DialogDescription>Enter actual denominations currently in drawer.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={recountBreakdown} setBreakdown={setRecountBreakdown} />
          </div>
          <div className="text-xl font-bold text-center mt-4">
            Total Cash: {formatCurrency(recountTotal)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecountOpen(false)}>Cancel</Button>
            <Button onClick={handleRecount}>Update Drawer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
