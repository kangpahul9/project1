import { Button } from "@/components/ui/button";

const NOTE_COLORS: Record<number, string> = {
  500: "bg-amber-400",
  200: "bg-orange-400",
  100: "bg-purple-400",
  50:  "bg-blue-400",
  20:  "bg-green-400",
  10:  "bg-yellow-400",
  5:   "bg-gray-300",
  2:   "bg-gray-400",
  1:   "bg-gray-500",
};

export function DenominationSelector({
  breakdown,
  setBreakdown,
  title,
}: {
  breakdown: { note: number; qty: number }[];
  setBreakdown: React.Dispatch<
    React.SetStateAction<{ note: number; qty: number }[]>
  >;
  title?: string;
}) {

  const adjust = (note: number, delta: number) => {
    setBreakdown(prev =>
      prev.map(n =>
        n.note === note
          ? { ...n, qty: Math.max(0, n.qty + delta) }
          : n
      )
    );
  };

  const total = breakdown.reduce(
    (sum, n) => sum + n.note * n.qty,
    0
  );

  return (
    <div className="space-y-8">

      {/* TOTAL DISPLAY */}
      <div className="text-center">
        {title && (
          <div className="text-sm text-gray-500">{title}</div>
        )}
        <div className="text-3xl font-bold text-green-600">
          ₹{total}
        </div>
      </div>

      {/* NOTES GRID */}
      <div className="grid grid-cols-3 gap-8">

        {breakdown.map(n => (
          <div key={n.note} className="flex flex-col items-center">

            {/* CIRCLE NOTE */}
            <div
              onClick={() => adjust(n.note, 1)}
              className={`w-24 h-24 rounded-full ${NOTE_COLORS[n.note]} flex items-center justify-center font-bold text-lg cursor-pointer shadow-md hover:scale-105 transition`}
            >
              ₹{n.note}
            </div>

            {/* COUNTER */}
            <div className="flex items-center gap-4 mt-4">

              <Button
                size="sm"
                variant="ghost"
                onClick={() => adjust(n.note, -1)}
              >
                −
              </Button>

              <div className="px-4 py-2 bg-primary text-white rounded-lg font-semibold">
                {n.qty}
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => adjust(n.note, 1)}
              >
                +
              </Button>

            </div>

          </div>
        ))}

      </div>
    </div>
  );
}
