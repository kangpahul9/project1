import { Sidebar } from "@/components/Sidebar";
import {
  useStaffWithBalance,
  useRoster,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useCopyRoster
} from "@/hooks/use-staff";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function generateWeek(startDate: string) {
  const start = dayjs(startDate);
  return Array.from({ length: 7 }).map((_, i) =>
    start.add(i, "day").format("YYYY-MM-DD")
  );
}

export default function Roster() {
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

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);

  const days = generateWeek(weekStart);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        {/* HEADER */}
        <div className="flex justify-between mb-6 items-center">
          <h1 className="text-3xl font-bold">Staff Roster</h1>

          <div className="flex gap-2">
            <Button
              onClick={() =>
                setWeekStart(
                  dayjs(weekStart).subtract(7, "day").format("YYYY-MM-DD")
                )
              }
            >
              ←
            </Button>

            <Button
              onClick={() =>
                setWeekStart(
                  dayjs(weekStart).add(7, "day").format("YYYY-MM-DD")
                )
              }
            >
              →
            </Button>

            {/* 🔥 COPY BUTTON */}
            <Button
  variant="outline"
  onClick={() => {
    copyRoster({
      from_date: weekStart,
      to_date: dayjs(weekStart)
        .add(7, "day")
        .format("YYYY-MM-DD"),
    });
    
  }}
>
  Copy Week
</Button>
          </div>
        </div>

        {/* GRID */}
        <div className="overflow-x-auto bg-white rounded-xl shadow">
          <div className="min-w-[1000px]">

            {/* HEADER ROW */}
            <div className="grid grid-cols-8 border-b bg-muted/40">
              <div className="p-3 font-semibold border-r">Staff</div>
              {days.map((d) => (
                <div key={d} className="p-3 text-center border-r text-sm">
                  {dayjs(d).format("ddd DD")}
                </div>
              ))}
            </div>

            {/* STAFF ROWS */}
            {staff?.map((member: any) => (
              <div key={member.id} className="grid grid-cols-8 border-b">

                {/* NAME */}
                <div className="p-3 border-r bg-muted/20 font-medium">
                  {member.name}
                </div>

                {/* DAYS */}
                {days.map((day) => {
                  const shifts =
                    roster?.filter(
                      (r: any) =>
                        dayjs(r.date).format("YYYY-MM-DD") === day &&
                        r.staff.some((s: any) => s.id === member.id)
                    ) || [];

                  return (
                    <div
                      key={day}
                      className="p-2 border-r min-h-[100px] space-y-1"
                    >
                      {/* SHIFTS */}
                      {shifts.map((shift: any) => (
                        <div
                          key={shift.shift_id}
                          className="bg-green-100 border text-xs p-2 rounded cursor-pointer hover:scale-[1.02] transition"
                          onClick={() => {
                            setSelectedShift(shift);
                            setSelectedDay(day);
                            setStartTime(shift.shift_start.slice(0, 5));
                            setEndTime(shift.shift_end.slice(0, 5));
                            setSelectedStaffIds(
                              shift.staff.map((s: any) => s.id)
                            );
                            setModalOpen(true);
                          }}
                        >
                          <div className="font-medium">
                            {shift.shift_start.slice(0, 5)} -{" "}
                            {shift.shift_end.slice(0, 5)}
                          </div>

                          <div className="text-[10px] opacity-70">
                            {shift.staff
                              .slice(0, 2)
                              .map((s: any) => s.name)
                              .join(", ")}
                            {shift.staff.length > 2 &&
                              ` +${shift.staff.length - 2}`}
                          </div>
                        </div>
                      ))}

                      {/* ADD BUTTON */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-xs"
                        onClick={() => {
                          setSelectedShift(null);
                          setSelectedDay(day);
                          setStartTime("");
                          setEndTime("");
                          setSelectedStaffIds([member.id]);
                          setModalOpen(true);
                        }}
                      >
                      </Button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* MODAL */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedShift ? "Edit Shift" : "Create Shift"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">

              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />

              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />

              {/* STAFF SELECT */}
              <div className="border p-2 rounded max-h-40 overflow-y-auto">
                {staff?.map((s: any) => (
                  <label key={s.id} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedStaffIds.includes(s.id)}
                      onChange={() => {
                        setSelectedStaffIds((prev) =>
                          prev.includes(s.id)
                            ? prev.filter((id) => id !== s.id)
                            : [...prev, s.id]
                        );
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>

              {/* SAVE */}
              <Button
                onClick={() => {
                  if (!startTime || !endTime) return;

                  if (selectedShift) {
                    updateShift({
                      id: selectedShift.shift_id,
                      shift_start: startTime,
                      shift_end: endTime,
                      staff_ids: selectedStaffIds,
                    });
                  } else {
                    createShift({
                      date: selectedDay,
                      shift_start: startTime,
                      shift_end: endTime,
                      staff_ids: selectedStaffIds,
                    });
                  }

                  setModalOpen(false);
                }}
              >
                Save
              </Button>

              {/* DELETE */}
              {selectedShift && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteShift(selectedShift.shift_id);
                    setModalOpen(false);
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}