import { Sidebar } from "@/components/Sidebar";
import { useBankHistory } from "@/hooks/use-bank";
import { Loader2, Landmark, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useMemo } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { format as formatDate } from "date-fns";
import { cn } from "@/lib/utils";

export default function BankHistory() {
  const { data, isLoading, isError } = useBankHistory();
  const { format: formatAmount } = useCurrency();

  const displayData = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    let balance = 0;
    const withBalance = sorted.map((tx: any) => {
      const amount = Number(tx.amount);
      balance += tx.type === "credit" ? amount : -amount;
      return { ...tx, runningBalance: balance };
    });
    return withBalance.reverse();
  }, [data]);

  const currentBalance = displayData[0]?.runningBalance ?? 0;
  const totalCredits = useMemo(() =>
    displayData.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + Number(t.amount), 0),
    [displayData]);
  const totalDebits = useMemo(() =>
    displayData.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + Number(t.amount), 0),
    [displayData]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="animate-spin w-7 h-7 text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background text-red-600 dark:text-red-400">
        Failed to load bank history
      </div>
    );
  }

  return (
    <div className="flex bg-background min-h-screen pt-16 lg:pt-8">
      <Sidebar />
      <main className="flex-1 min-w-0 ml-0 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <Landmark className="w-6 h-6 text-primary shrink-0" />
            Bank Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All bank deposits and withdrawals
          </p>
        </div>

        {/* ── Summary strip ── */}
        {displayData.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className={cn(
              "rounded-2xl p-5 border shadow-sm",
              currentBalance >= 0
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
            )}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Current Balance</p>
              <p className={cn(
                "text-2xl font-bold",
                currentBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>{formatAmount(currentBalance)}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Total Credits</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatAmount(totalCredits)}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Total Debits</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatAmount(totalDebits)}</p>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {displayData.length === 0 && (
          <div className="bg-card border border-border/60 rounded-2xl p-16 text-center shadow-sm">
            <Landmark className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground mt-1">Bank transactions will appear here.</p>
          </div>
        )}

        {/* ── Mobile cards ── */}
        {displayData.length > 0 && (
          <div className="space-y-2 sm:hidden">
            {displayData.map((tx: any) => (
              <div
                key={tx.id}
                className="bg-card rounded-2xl shadow-sm border border-border/60 p-4 flex items-center gap-3"
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  tx.type === "credit"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                )}>
                  {tx.type === "credit"
                    ? <ArrowDownLeft className="w-4 h-4" />
                    : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm capitalize truncate">
                    {tx.source.replaceAll("_", " ")}
                  </p>
                  {tx.description && (
                    <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(new Date(tx.created_at), "MMM d, yyyy · h:mm a")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    "font-bold text-sm tabular-nums",
                    tx.type === "credit"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {tx.type === "credit" ? "+" : "−"}{formatAmount(Number(tx.amount))}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                    Bal: {formatAmount(tx.runningBalance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Desktop table ── */}
        {displayData.length > 0 && (
          <div className="hidden sm:block bg-card rounded-2xl shadow-sm border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Balance</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Source</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        {formatAmount(Number(tx.amount))}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
                        {formatAmount(tx.runningBalance)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-semibold",
                          tx.type === "credit"
                            ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                        )}>
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-foreground">
                        {tx.source.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tx.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(new Date(tx.created_at), "MMM d, yyyy · h:mm a")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
