import { useWithdrawalHistory, useDepositHistory } from "@/hooks/use-withdraw";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, ArrowDownLeft, ArrowUpRight, Download, TrendingDown } from "lucide-react";
import { useState, useMemo } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";

export default function WithdrawalHistory() {
  const { format } = useCurrency();
  const [range, setRange] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [mode, setMode] = useState<"withdrawal" | "deposit">("withdrawal");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const today = new Date();

  const computedFilters = useMemo(() => {
    if (range === "weekly") {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      return { from: weekAgo.toISOString().split("T")[0], to: today.toISOString().split("T")[0] };
    }
    if (range === "monthly") {
      const monthAgo = new Date();
      monthAgo.setMonth(today.getMonth() - 1);
      return { from: monthAgo.toISOString().split("T")[0], to: today.toISOString().split("T")[0] };
    }
    if (customFrom && customTo) return { from: customFrom, to: customTo };
    return {};
  }, [range, customFrom, customTo]);

  const { data: withdrawalData, isLoading: loadingWithdrawals } = useWithdrawalHistory(computedFilters);
  const { data: depositData, isLoading: loadingDeposits } = useDepositHistory(computedFilters);

  const data = mode === "withdrawal" ? withdrawalData : depositData;
  const isLoading = mode === "withdrawal" ? loadingWithdrawals : loadingDeposits;

  const totalWithdrawals = useMemo(() =>
    withdrawalData?.reduce((s: number, w: any) => s + Number(w.amount), 0) || 0,
    [withdrawalData]);
  const totalDeposits = useMemo(() =>
    depositData?.reduce((s: number, d: any) => s + Number(d.amount), 0) || 0,
    [depositData]);
  const netImpact = totalDeposits - totalWithdrawals;

  const reasonBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    data?.forEach((w: any) => { map[w.reason] = (map[w.reason] || 0) + Number(w.amount); });
    return Object.entries(map).map(([reason, amount]) => ({ reason, amount }));
  }, [data]);

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Date", "Amount", "Reason", "Owner"];
    const rows = data.map((w: any) => [
      new Date(w.created_at).toLocaleString(), w.amount, w.reason, w.owner_name || "-"
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = mode === "withdrawal" ? "withdrawals.csv" : "deposits.csv";
    link.click();
  };

  const isWithdrawal = mode === "withdrawal";

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-8 overflow-y-auto">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
              <TrendingDown className="w-6 h-6 text-primary shrink-0" />
              Cash Flow Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track withdrawals &amp; deposits over time
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 shrink-0">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
            <button
              onClick={() => setMode("withdrawal")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition",
                mode === "withdrawal"
                  ? "bg-card shadow text-red-600 dark:text-red-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight className="w-3.5 h-3.5 inline mr-1.5" />Withdrawals
            </button>
            <button
              onClick={() => setMode("deposit")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition",
                mode === "deposit"
                  ? "bg-card shadow text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 inline mr-1.5" />Deposits
            </button>
          </div>

          {/* Range toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl">
            {(["weekly", "monthly", "custom"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition",
                  range === r ? "bg-card shadow text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* ── Custom date range ── */}
        {range === "custom" && (
          <div className="flex flex-wrap gap-3 mb-6">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-44" />
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-44" />
          </div>
        )}

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-red-200 dark:border-red-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Total Withdrawals</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{format(totalWithdrawals)}</p>
          </div>
          <div className="bg-card border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Total Deposits</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{format(totalDeposits)}</p>
          </div>
          <div className={cn(
            "rounded-2xl p-5 shadow-sm border",
            netImpact >= 0
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          )}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Net Impact</p>
            <p className={cn(
              "text-2xl font-bold",
              netImpact >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {format(netImpact)}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Bar chart ── */}
            {reasonBreakdown.length > 0 && (
              <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5 mb-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  By Reason
                </p>
                <ResponsiveContainer width="100%" height={Math.max(180, reasonBreakdown.length * 36)}>
                  <BarChart layout="vertical" data={reasonBreakdown} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      width={100}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "13px",
                      }}
                    />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                      {reasonBreakdown.map((_, i) => (
                        <Cell
                          key={i}
                          fill={isWithdrawal ? "hsl(0 84% 60%)" : "hsl(142 71% 45%)"}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Transactions table ── */}
            {(!data || data.length === 0) ? (
              <div className="bg-card border border-border/60 rounded-2xl p-16 text-center shadow-sm">
                <TrendingDown className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="font-semibold text-foreground">No {mode}s in this period</p>
              </div>
            ) : (
              <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/60 bg-muted/40">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {data.length} transaction{data.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[540px]">
                    <thead>
                      <tr className="border-b border-border/40 text-xs text-muted-foreground">
                        <th className="px-5 py-3 text-left font-semibold">Date</th>
                        <th className="px-5 py-3 text-left font-semibold">Amount</th>
                        <th className="px-5 py-3 text-left font-semibold">Reason</th>
                        <th className="px-5 py-3 text-left font-semibold">User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((w: any) => (
                        <tr key={w.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {formatDate(new Date(w.created_at), "MMM d, yyyy · h:mm a")}
                          </td>
                          <td className={cn(
                            "px-5 py-3 font-semibold tabular-nums",
                            isWithdrawal
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {isWithdrawal ? "−" : "+"}{format(w.amount)}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{w.reason}</td>
                          <td className="px-5 py-3 text-muted-foreground text-xs">{w.owner_name || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        </div>
      </main>
    </div>
  );
}
