import { Button } from "@/components/ui/button";
import { useCurrency, DENOMS_AUD, DENOMS_INR } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

// ── AUD coins ────────────────────────────────────────────────────
import audImg5c   from "@assets/$05cents_1779941882963.jpg";
import audImg10c  from "@assets/$010cents_1779941882966.jpg";
import audImg20c  from "@assets/$020cents_1779941882966.jpg";
import audImg50c  from "@assets/$050cents_1779941882966.jpg";
import audImg1    from "@assets/$1_1779941768327.jpg";
import audImg2    from "@assets/$2_1779941768331.jpeg";

// ── AUD notes ────────────────────────────────────────────────────
import audImg5    from "@assets/$5_1779941768331.jpg";
import audImg10   from "@assets/$10_1779941768331.jpg";
import audImg20   from "@assets/$20_1779941768332.jpg";
import audImg50   from "@assets/$50_1779941768332.jpg";
import audImg100  from "@assets/$100_1779941768332.jpg";

// ── INR coins ────────────────────────────────────────────────────
import inrImg1    from "@assets/1inr_1779942569537.jpg";
import inrImg2    from "@assets/2inr_1779942569540.jpg";
import inrImg5    from "@assets/5inr_1779942569540.jpg";

// ── INR notes ────────────────────────────────────────────────────
import inrImg10   from "@assets/10inr_1779942569540.jpeg";
import inrImg20   from "@assets/20inr_1779942569540.jpg";
import inrImg50   from "@assets/50inr_1779942569540.jpeg";
import inrImg100  from "@assets/100inr_1779942569541.jpeg";
import inrImg200  from "@assets/200inr_1779942569541.jpg";
import inrImg500  from "@assets/500inr_1779942569541.webp";

type DenomMeta = { src: string; kind: "coin" | "note" };

const DENOM_IMG: Record<string, DenomMeta> = {
  // AUD coins
  "0.05": { src: audImg5c,  kind: "coin" },
  "0.1":  { src: audImg10c, kind: "coin" },
  "0.2":  { src: audImg20c, kind: "coin" },
  "0.5":  { src: audImg50c, kind: "coin" },
  "1":    { src: audImg1,   kind: "coin" },
  "2":    { src: audImg2,   kind: "coin" },
  // AUD notes
  "5":    { src: audImg5,   kind: "note" },
  "10":   { src: audImg10,  kind: "note" },
  "20":   { src: audImg20,  kind: "note" },
  "50":   { src: audImg50,  kind: "note" },
  "100":  { src: audImg100, kind: "note" },
};

// INR — separate map so AUD "1", "2", "5" take priority above
// (INR uses integer keys that don't overlap with AUD fractional coins)
const INR_IMG: Record<string, DenomMeta> = {
  "1":   { src: inrImg1,   kind: "coin" },
  "2":   { src: inrImg2,   kind: "coin" },
  "5":   { src: inrImg5,   kind: "coin" },
  "10":  { src: inrImg10,  kind: "note" },
  "20":  { src: inrImg20,  kind: "note" },
  "50":  { src: inrImg50,  kind: "note" },
  "100": { src: inrImg100, kind: "note" },
  "200": { src: inrImg200, kind: "note" },
  "500": { src: inrImg500, kind: "note" },
};

export function CashBreakdownDisplay({
  breakdown,
}: {
  breakdown: { note_value: number; quantity: number }[];
}) {
  const { format, code } = useCurrency();
  const validDenoms = code === "AUD" ? DENOMS_AUD : DENOMS_INR;
  const imgMap = code === "AUD" ? DENOM_IMG : INR_IMG;

  const active = breakdown
    .filter(n => n.quantity > 0 && validDenoms.includes(Number(n.note_value)))
    .sort((a, b) => Number(b.note_value) - Number(a.note_value));

  if (active.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No cash recorded in drawer.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-5">
      {active.map(n => {
        const key = String(Number(n.note_value));
        const meta = imgMap[key];
        return (
          <div key={n.note_value} className="flex flex-col items-center gap-2">
            {meta ? (
              meta.kind === "coin" ? (
                <div className="w-16 h-16 rounded-full overflow-hidden shadow-md">
                  <img src={meta.src} alt={format(n.note_value)} className="w-full h-full object-cover" draggable={false} />
                </div>
              ) : (
                <div className="w-full aspect-[2/1] rounded-xl overflow-hidden shadow-md">
                  <img src={meta.src} alt={format(n.note_value)} className="w-full h-full object-cover object-center" draggable={false} />
                </div>
              )
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-sm bg-muted text-foreground shadow-md">
                {format(n.note_value)}
              </div>
            )}
            <p className="text-2xl font-bold tabular-nums text-foreground leading-none">
              ×{n.quantity}
            </p>
            <p className="text-xs text-muted-foreground font-medium tabular-nums -mt-1">
              {format(n.note_value)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function DenominationSelector({
  breakdown,
  setBreakdown,
  title,
}: {
  breakdown: { note: number; qty: number }[];
  setBreakdown: React.Dispatch<React.SetStateAction<{ note: number; qty: number }[]>>;
  title?: string;
}) {
  const adjust = (note: number, delta: number) => {
    setBreakdown(prev =>
      prev.map(n => n.note === note ? { ...n, qty: Math.max(0, n.qty + delta) } : n)
    );
  };

  const { format } = useCurrency();
  const total = breakdown.reduce((sum, n) => sum + n.note * n.qty, 0);

  // Detect currency: if any denomination has a fractional part it's AUD; otherwise INR
  const isAUD = breakdown.some(n => !Number.isInteger(n.note));
  const imgMap = isAUD ? DENOM_IMG : INR_IMG;

  return (
    <div className="space-y-8">

      {/* ── Total display ── */}
      <div className="text-center">
        {title && <div className="text-sm text-muted-foreground mb-0.5">{title}</div>}
        <div className={cn(
          "text-3xl font-bold",
          total > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
        )}>
          {format(total)}
        </div>
      </div>

      {/* ── Denomination grid ── */}
      <div className="grid grid-cols-3 gap-6">
        {breakdown.map(n => {
          const key = String(n.note);
          const meta = imgMap[key];
          const active = n.qty > 0;

          return (
            <div key={n.note} className="flex flex-col items-center gap-3">

              {meta ? (
                meta.kind === "coin" ? (
                  /* ── Circle coin ── */
                  <div
                    onClick={() => adjust(n.note, 1)}
                    className={cn(
                      "w-20 h-20 rounded-full overflow-hidden cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-transform",
                      active && "ring-4 ring-primary ring-offset-2"
                    )}
                  >
                    <img src={meta.src} alt={format(n.note)} className="w-full h-full object-cover" draggable={false} />
                  </div>
                ) : (
                  /* ── Rectangle note ── */
                  <div
                    onClick={() => adjust(n.note, 1)}
                    className={cn(
                      "w-full aspect-[2/1] rounded-xl overflow-hidden cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-transform",
                      active && "ring-4 ring-primary ring-offset-2"
                    )}
                  >
                    <img src={meta.src} alt={format(n.note)} className="w-full h-full object-cover object-center" draggable={false} />
                  </div>
                )
              ) : (
                /* ── Fallback: show value text in a coloured circle ── */
                <div
                  onClick={() => adjust(n.note, 1)}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center font-bold text-lg cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-transform bg-muted text-foreground",
                    active && "ring-4 ring-primary ring-offset-2"
                  )}
                >
                  {format(n.note)}
                </div>
              )}

              {/* ── Counter ── */}
              <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" onClick={() => adjust(n.note, -1)}>−</Button>
                <div className={cn(
                  "px-4 py-1.5 rounded-lg font-semibold min-w-[2.5rem] text-center text-sm",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {n.qty}
                </div>
                <Button size="sm" variant="ghost" onClick={() => adjust(n.note, 1)}>+</Button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
