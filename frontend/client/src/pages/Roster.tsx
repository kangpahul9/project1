import { Sidebar } from "@/components/Sidebar";
import { useStaffWithBalance, useRoster,useCreateShift, useUpdateShift, useDeleteShift } from "@/hooks/use-staff";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function generateWeek(startDate: string) {
  const start = dayjs(startDate);
  return Array.from({ length: 7 }).map((_, i) =>
    start.add(i, "day").format("YYYY-MM-DD")
  );
}

function formatHeader(date: string) {
  return dayjs(date).format("ddd - DD MMM");
}

export default function Roster() {
  const [weekStart, setWeekStart] = useState(
    dayjs().startOf("week").add(1, "day").format("YYYY-MM-DD")
  );

  const weekEnd = dayjs(weekStart).add(6, "day").format("YYYY-MM-DD");

  const { data: staff } = useStaffWithBalance();
  const { data: roster } = useRoster(weekStart, weekEnd);
  const [modalOpen, setModalOpen] = useState(false);
const [selectedCell, setSelectedCell] = useState<any>(null);
const [startTime, setStartTime] = useState("");
const [endTime, setEndTime] = useState("");
const { mutate: createShift } = useCreateShift();
const { mutate: updateShift } = useUpdateShift();
const { mutate: deleteShift } = useDeleteShift();
  const days = generateWeek(weekStart);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Staff Roster</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Week of {dayjs(weekStart).format("DD MMM YYYY")}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-muted/40 transition"
              onClick={() =>
                setWeekStart(
                  dayjs(weekStart)
                    .subtract(7, "day")
                    .format("YYYY-MM-DD")
                )
              }
            >
              ← Prev
            </button>

            <button
              className="px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-muted/40 transition"
              onClick={() =>
                setWeekStart(
                  dayjs(weekStart)
                    .add(7, "day")
                    .format("YYYY-MM-DD")
                )
              }
            >
              Next →
            </button>
          </div>
        </div>

        {/* Grid Container */}
        <div className="overflow-x-auto bg-white rounded-xl shadow-md">
          <div className="min-w-[1000px]">

            {/* Header Row */}
            <div className="grid grid-cols-8 border-b bg-muted/40 sticky top-0 z-10">
              <div className="p-4 font-semibold bg-muted/20 border-r">
                Staff
              </div>
              {days.map((day) => (
                <div
                  key={day}
                  className="p-4 font-semibold text-center border-r"
                >
                  {formatHeader(day)}
                </div>
              ))}
            </div>

            {/* Staff Rows */}
            {staff?.map((member: any) => (
              <div
                key={member.id}
                className="grid grid-cols-8 border-b hover:bg-muted/10 transition"
              >
                <div className="p-4 font-medium bg-muted/20 border-r">
                  {member.name}
                </div>

                {days.map((day) => {
                  const shift = roster?.find(
                    (r: any) =>
                      r.staff_id === member.id &&
                      dayjs(r.date).format("YYYY-MM-DD") === day
                  );

                  return (
                    <div
  key={day}
  className="p-3 border-r min-h-[90px] flex items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors"
  onClick={() => {
    setSelectedCell({
      staff_id: member.id,
      date: day,
      shift,
    });

    setStartTime(
  shift?.shift_start
    ? dayjs(`${shift.date} ${shift.shift_start}`).format("HH:mm")
    : ""
);

setEndTime(
  shift?.shift_end
    ? dayjs(`${shift.date} ${shift.shift_end}`).format("HH:mm")
    : ""
);
    setModalOpen(true);
  }}
>
                      {shift ? (
                        <div className="bg-green-100 border border-green-300 text-green-900 text-xs px-3 py-2 rounded-lg text-center w-full shadow-sm">
{shift.shift_start?.slice(0,5)}
                          <br />
                          –
                          <br />
{shift.shift_end?.slice(0,5)}                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          </div>
        </div>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>
        {selectedCell?.shift ? "Edit Shift" : "Add Shift"}
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

      <Button
        className="w-full"
        onClick={() => {
          if (!startTime || !endTime) return;

          if (selectedCell?.shift) {
            updateShift({
              id: selectedCell.shift.id,
              shift_start: startTime,
              shift_end: endTime,
            });
          } else {
            createShift({
              staff_id: selectedCell.staff_id,
              date: selectedCell.date,
              shift_start: startTime,
              shift_end: endTime,
            });
          }

          setModalOpen(false);
        }}
      >
        Save
      </Button>

      {selectedCell?.shift && (
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            deleteShift(selectedCell.shift.id);
            setModalOpen(false);
          }}
        >
          Delete Shift
        </Button>
      )}
    </div>
  </DialogContent>
</Dialog>
      </main>
    </div>
  );
}