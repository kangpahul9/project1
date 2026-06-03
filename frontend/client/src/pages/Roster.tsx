import { Sidebar } from "@/components/Sidebar";
import {
  useRoster, useCreateShift, useUpdateShift, useDeleteShift, useCopyRoster,
  useClockIn, useClockOut, useStaffOverview, usePayTypes, useCreatePayType,
  useUpdatePayType, useDeletePayType, type StaffOverview, type PayType,
} from "@/hooks/use-roster";
import { useStaffWithBalance } from "@/hooks/use-staff";
import { useAuthStore } from "@/hooks/use-auth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import dayjs from "dayjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

function generateWeek(startDate: string) {
  const start = dayjs(startDate);
  return Array.from({ length: 7 }).map((_, i) => start.add(i, "day").format("YYYY-MM-DD"));
}

function OverviewPanel() {
  const { data: overview } = useStaffOverview();
  const o = overview as StaffOverview | undefined;
  if (!o) return null;

  const statusCls: Record<string, string> = {
    working:  "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    late:     "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    absent:   "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400",
    upcoming: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  };

  const allStaff = [
    ...(o.working ?? []).map(s => ({ ...s, status: "working" as const })),
    ...(o.late ?? []).map(s => ({ ...s, status: "late" as const })),
    ...(o.absent ?? []).map(s => ({ ...s, status: "absent" as const })),
    ...(o.upcoming ?? []).map(s => ({ ...s, status: "upcoming" as const })),
  ];

  if (allStaff.length === 0) return null;

  return (
    <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-4 mb-5">
      <p className="text-sm font-semibold mb-3">Live Overview</p>
      <div className="flex flex-wrap gap-2">
        {allStaff.map(s => (
          <span
            key={`${s.id}-${s.status}`}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium", statusCls[s.status])}
          >
            {s.name}{s.shift_start && ` · ${s.shift_start.slice(0, 5)}`}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Roster() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const [weekStart, setWeekStart] = useState(
    dayjs().startOf("week").add(1, "day").format("YYYY-MM-DD")
  );
  const weekEnd = dayjs(weekStart).add(6, "day").format("YYYY-MM-DD");

  const { data: staff } = useStaffWithBalance();
  const { data: roster } = useRoster(weekStart, weekEnd);

  const { mutate: createShift } = useCreateShift();
  const { mutate: updateShift } = useUpdateShift();
  const { mutate: deleteShift } = useDeleteShift();
  const { mutate: copyRoster } = useCopyRoster();
  const { mutate: clockIn, isPending: clockingIn } = useClockIn();
  const { mutate: clockOut, isPending: clockingOut } = useClockOut();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [baseRate, setBaseRate] = useState<number | "">("");
  const [payTypeId, setPayTypeId] = useState<number | "">("");

  const { data: payTypes } = usePayTypes();
  const { mutate: createPayType, isPending: creatingPT } = useCreatePayType();
  const { mutate: updatePayType, isPending: updatingPT } = useUpdatePayType();
  const { mutate: deletePayType } = useDeletePayType();

  const [ptDialogOpen, setPtDialogOpen] = useState(false);
  const [editingPT, setEditingPT] = useState<PayType | null>(null);
  const [ptName, setPtName] = useState("");
  const [ptBaseRate, setPtBaseRate] = useState<number | "">("");

  const openNewPT = () => { setEditingPT(null); setPtName(""); setPtBaseRate(""); setPtDialogOpen(true); };
  const openEditPT = (pt: PayType) => { setEditingPT(pt); setPtName(pt.name); setPtBaseRate(pt.base_rate); setPtDialogOpen(true); };

  const savePT = () => {
    if (!ptName || ptBaseRate === "" || Number(ptBaseRate) <= 0) return;
    if (editingPT) {
      updatePayType({ id: editingPT.id, name: ptName, base_rate: Number(ptBaseRate) }, { onSuccess: () => setPtDialogOpen(false) });
    } else {
      createPayType({ name: ptName, base_rate: Number(ptBaseRate) }, { onSuccess: () => setPtDialogOpen(false) });
    }
  };

  const handlePayTypeChange = (val: string) => {
    if (val === "none") {
      setPayTypeId("");
      setBaseRate("");
      return;
    }
    const id = Number(val);
    setPayTypeId(id);
    const pt = payTypes?.find(p => p.id === id);
    if (pt) setBaseRate(pt.base_rate);
  };

  const days = generateWeek(weekStart);

  return (
    <div className="flex bg-background min-h-screen pt-16 lg:pt-8">
      <Sidebar />
      <main className="flex-1 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-primary shrink-0" />
            Staff Roster
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Week nav */}
            <Button variant="outline" size="icon"
              onClick={() => setWeekStart(dayjs(weekStart).subtract(7, "day").format("YYYY-MM-DD"))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[170px] text-center">
              {dayjs(weekStart).format("D MMM")} – {dayjs(weekEnd).format("D MMM YYYY")}
            </span>
            <Button variant="outline" size="icon"
              onClick={() => setWeekStart(dayjs(weekStart).add(7, "day").format("YYYY-MM-DD"))}>
              <ChevronRight className="w-4 h-4" />
            </Button>

            {isAdmin && (
              <>
                <Button variant="outline" size="sm"
                  onClick={() => copyRoster({ from_date: weekStart, to_date: dayjs(weekStart).add(7, "day").format("YYYY-MM-DD") })}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Week
                </Button>
                <Button variant="outline" size="sm" onClick={openNewPT}>
                  <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Pay Types
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Clock In / Out — Staff Only ── */}
        {!isAdmin && (
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold text-sm">Attendance</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clock in when your shift starts, clock out when it ends.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => clockIn({})} disabled={clockingIn}
                className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {clockingIn ? "Clocking In…" : "Clock In"}
              </Button>
              <Button onClick={() => clockOut({})} disabled={clockingOut}
                variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                {clockingOut ? "Clocking Out…" : "Clock Out"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Admin Overview ── */}
        {isAdmin && <OverviewPanel />}

        {/* ── Grid ── */}
        <div className="overflow-x-auto bg-card border border-border/60 rounded-2xl shadow-sm">
          <div className="min-w-[1000px] p-3 sm:p-4">

            {/* Header row */}
            <div className="grid grid-cols-8 border-b border-border/60 bg-muted/40 rounded-t-xl">
              <div className="p-3 font-semibold text-sm border-r border-border/60">Staff</div>
              {days.map(d => (
                <div key={d} className="p-3 text-center border-r border-border/60 text-sm font-medium">
                  <span className={cn(
                    dayjs(d).format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD")
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  )}>
                    {dayjs(d).format("ddd DD")}
                  </span>
                </div>
              ))}
            </div>

            {/* Staff rows */}
            {staff?.map((member: any) => (
              <div key={member.id} className="grid grid-cols-8 border-b border-border/50 last:border-0">
                <div className="p-3 border-r border-border/50 bg-muted/20 font-medium text-sm">
                  {member.name}
                </div>
                {days.map(day => {
                  const shifts = roster?.filter(
                    (r: any) => dayjs(r.date).format("YYYY-MM-DD") === day &&
                      r.staff.some((s: any) => s.id === member.id)
                  ) || [];
                  const openAdd = () => {
                    if (!isAdmin) return;
                    setSelectedShift(null);
                    setSelectedDay(day);
                    setStartTime(""); setEndTime("");
                    setSelectedStaffIds([member.id]);
                    setBaseRate(""); setPayTypeId("");
                    setModalOpen(true);
                  };
                  return (
                    <div
                      key={day}
                      className={cn(
                        "p-2 sm:p-3 border-r border-border/50 min-h-[90px] sm:min-h-[110px] space-y-1",
                        isAdmin && "cursor-pointer hover:bg-muted/50 transition-colors"
                      )}
                      onClick={openAdd}
                    >
                      {shifts.map((shift: any) => (
                        <div
                          key={shift.id}
                          className="bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs p-2 rounded-xl shadow-sm hover:shadow-md transition cursor-pointer"
                          onClick={e => {
                            if (!isAdmin) return;
                            e.stopPropagation();
                            setSelectedShift(shift);
                            setSelectedDay(day);
                            setStartTime(shift.shift_start.slice(0, 5));
                            setEndTime(shift.shift_end.slice(0, 5));
                            setSelectedStaffIds(shift.staff.map((s: any) => s.id));
                            setBaseRate(shift.base_rate ?? "");
                            setPayTypeId(shift.pay_type_id ?? "");
                            setModalOpen(true);
                          }}
                        >
                          <div className="font-semibold">
                            {shift.shift_start.slice(0, 5)} – {shift.shift_end.slice(0, 5)}
                          </div>
                          <div className="text-[10px] opacity-70">
                            {shift.staff.slice(0, 2).map((s: any) => s.name).join(", ")}
                            {shift.staff.length > 2 && ` +${shift.staff.length - 2}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Shift Modal ── */}
        {isAdmin && (
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>{selectedShift ? "Edit Shift" : "Create Shift"}</DialogTitle>
                {selectedDay && (
                  <p className="text-sm text-muted-foreground">
                    {dayjs(selectedDay).format("dddd, D MMMM YYYY")}
                  </p>
                )}
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Start Time</label>
                    <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">End Time</label>
                    <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Pay Type</label>
                    <Select value={payTypeId === "" ? "none" : String(payTypeId)} onValueChange={handlePayTypeChange}>
                      <SelectTrigger><SelectValue placeholder="— None —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {payTypes?.map(pt => (
                          <SelectItem key={pt.id} value={String(pt.id)}>{pt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Base Rate ($/hr)</label>
                    <Input
                      readOnly tabIndex={-1}
                      className="bg-muted cursor-not-allowed text-muted-foreground"
                      value={baseRate !== "" ? `$${Number(baseRate).toFixed(2)}` : "—"}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Staff</label>
                  <div className="border border-border/60 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1">
                    {staff?.map((s: any) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5 rounded hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={selectedStaffIds.includes(s.id)}
                          onChange={() => {
                            setSelectedStaffIds(prev =>
                              prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                            );
                          }}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={!startTime || !endTime || selectedStaffIds.length === 0}
                  onClick={() => {
                    if (selectedShift) {
                      updateShift({
                        id: selectedShift.id, shift_start: startTime, shift_end: endTime,
                        staff_ids: selectedStaffIds,
                        base_rate: baseRate !== "" ? Number(baseRate) : undefined,
                        pay_type_id: payTypeId !== "" ? Number(payTypeId) : undefined,
                      });
                    } else {
                      createShift({
                        date: selectedDay ?? "", shift_start: startTime, shift_end: endTime,
                        staff_ids: selectedStaffIds,
                        base_rate: baseRate !== "" ? Number(baseRate) : undefined,
                        pay_type_id: payTypeId !== "" ? Number(payTypeId) : undefined,
                      });
                    }
                    setModalOpen(false);
                  }}>
                  Save Shift
                </Button>
                {selectedShift && (
                  <Button variant="destructive" className="w-full"
                    onClick={() => { deleteShift(selectedShift.id); setModalOpen(false); }}>
                    Delete Shift
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* ── Pay Types Dialog ── */}
        {isAdmin && (
          <Dialog open={ptDialogOpen} onOpenChange={setPtDialogOpen}>
            <DialogContent className="max-w-lg" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> Pay Types
                </DialogTitle>
              </DialogHeader>
              <div className="border border-border/60 rounded-xl divide-y divide-border/50 max-h-52 overflow-y-auto mb-4">
                {payTypes?.length === 0 && (
                  <p className="text-sm text-muted-foreground p-3">No pay types yet.</p>
                )}
                {payTypes?.map(pt => (
                  <div key={pt.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{pt.name}</p>
                      <p className="text-xs text-muted-foreground">${Number(pt.base_rate).toFixed(2)}/hr</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditPT(pt)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => deletePayType(pt.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/60 pt-4 space-y-3">
                <p className="text-sm font-semibold">
                  {editingPT ? `Editing: ${editingPT.name}` : "New Pay Type"}
                </p>
                <Input placeholder="Name (e.g. Regular, Overtime)" value={ptName}
                  onChange={e => setPtName(e.target.value)} />
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Base Rate ($/hr)</label>
                  <Input type="number" min={0.01} step={0.01} placeholder="e.g. 25.00"
                    value={ptBaseRate}
                    onChange={e => setPtBaseRate(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1"
                    disabled={!ptName || ptBaseRate === "" || Number(ptBaseRate) <= 0 || creatingPT || updatingPT}
                    onClick={savePT}>
                    {editingPT ? "Update" : "Add Pay Type"}
                  </Button>
                  {editingPT && (
                    <Button variant="outline"
                      onClick={() => { setEditingPT(null); setPtName(""); setPtBaseRate(""); }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </main>
    </div>
  );
}
