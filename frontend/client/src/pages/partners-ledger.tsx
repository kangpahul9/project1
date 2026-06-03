import { Sidebar } from "@/components/Sidebar";
import { usePartnerLedger } from "@/hooks/use-partners";
import { Loader2, TrendingUp, TrendingDown, Users, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

export default function PartnerLedger() {
  const { format } = useCurrency();
  const { data, isLoading } = usePartnerLedger();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="animate-spin w-7 h-7 text-primary" />
      </div>
    );
  }

  const partners = data?.partners ?? [];
  const totalSales = data?.total_sales ?? 0;
  const totalExpenses = data?.total_expenses ?? 0;
  const totalProfit = data?.total_profit ?? 0;

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-60 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary shrink-0" />
            Partner Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Business performance shared across all partners
          </p>
        </div>

        {/* ── Summary strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Sales</p>
            <p className="text-2xl font-bold text-foreground">{format(totalSales)}</p>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Expenses</p>
            <p className="text-2xl font-bold text-foreground">{format(totalExpenses)}</p>
          </div>
          <div className={cn(
            "bg-card rounded-2xl p-5 relative overflow-hidden border",
            totalProfit >= 0
              ? "border-emerald-200 dark:border-emerald-800"
              : "border-red-200 dark:border-red-800"
          )}>
            <div className={cn(
              "absolute inset-0 opacity-[0.04]",
              totalProfit >= 0 ? "bg-emerald-500" : "bg-red-500"
            )} />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Net Result</p>
            <div className="flex items-center gap-2">
              <p className={cn(
                "text-2xl font-bold leading-none",
                totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {format(totalProfit)}
              </p>
              {totalProfit >= 0
                ? <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                : <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
              }
            </div>
            {totalProfit < 0 && (
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1.5">Expenses exceed sales</p>
            )}
          </div>
        </div>

        {/* ── Partner cards ── */}
        {partners.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-16 text-center">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-base font-semibold text-foreground">No partners yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Partners added to the system will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {partners.map((p: any) => {
              const positive = p.net_balance >= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/partners/${p.id}/ledger`)}
                  className="group bg-card border border-border/60 rounded-2xl p-5 text-left cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-foreground leading-tight">{p.name}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.share_percent}% profit share</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs px-2.5 py-1 rounded-full font-semibold shrink-0",
                        positive
                          ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                      )}>
                        {positive ? "In Profit" : "Owes"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition shrink-0" />
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Deposits</span>
                      <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{format(p.deposits)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Withdrawals</span>
                      <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{format(p.withdrawals)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Expenses Paid</span>
                      <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{format(p.expenses_paid)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Profit Share</span>
                      <span className="font-semibold tabular-nums text-primary">{format(Math.round(p.profit_share))}</span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Net Balance</p>
                      <p className={cn(
                        "text-lg font-bold leading-none",
                        positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {format(Math.round(p.net_balance))}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      View history
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        </div>
      </main>
    </div>
  );
}
