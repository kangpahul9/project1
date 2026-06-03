import { Sidebar } from "@/components/Sidebar";
import { usePartnerHistory } from "@/hooks/use-partners";
import { useRoute, useLocation } from "wouter";
import {
  Loader2, ArrowLeft, ArrowDownLeft, ArrowUpRight, Users,
} from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";

const EVENT_LABELS: Record<string, string> = {
  cash_sale:       "Sales Share",
  cash_deposit:    "Cash Deposit",
  cash_withdrawal: "Cash Withdrawal",
  expense:         "Expense Paid",
  expense_paid:    "Expense Paid",
  bank_deposit:    "Bank Deposit",
  bank_withdrawal: "Bank Withdrawal",
  cash_transfer:   "Cash → Bank",
  bank_to_cash:    "Bank → Cash",
  salary:          "Salary",
  profit_share:    "Profit Share",
  debit:           "Debit",
  credit:          "Credit",
};

function eventLabel(type: string) {
  return (
    EVENT_LABELS[type] ??
    type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ??
    "Transaction"
  );
}

function isDebit(event_type: string) {
  return (
    event_type?.includes("withdrawal") ||
    event_type?.includes("expense") ||
    event_type?.includes("debit") ||
    event_type?.includes("paid")
  );
}

function fmtTs(raw: string) {
  try {
    return formatDate(new Date(raw), "MMM d, yyyy · h:mm a");
  } catch { return "—"; }
}

export default function PartnerHistory() {
  const { format } = useCurrency();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/partners/:id/ledger");
  const partnerId = Number(params?.id);
  const { data, isLoading } = usePartnerHistory(partnerId);

  const partnerName = data?.[0]?.partner_name ?? `Partner #${partnerId}`;

  let runningBalance = 0;
  const rows = (data ?? []).map((row: any) => {
    const amount = Number(row.amount);
    const out = isDebit(row.event_type);
    runningBalance = out ? runningBalance - amount : runningBalance + amount;
    return { ...row, amount, out, balance: runningBalance };
  });
  const displayRows = [...rows].reverse();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="animate-spin w-7 h-7 text-primary" />
      </div>
    );
  }

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-60 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => navigate("/partners-ledger")}
          >
            <ArrowLeft className="w-4 h-4" /> Partners
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary shrink-0" />
              {partnerName}
            </h1>
            <p className="text-sm text-muted-foreground">Transaction history</p>
          </div>
        </div>

        {/* ── Balance banner ── */}
        {rows.length > 0 && (
          <div className={cn(
            "rounded-2xl p-5 mb-6 flex justify-between items-center border",
            runningBalance >= 0
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          )}>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Current Balance
              </p>
              <p className={cn(
                "text-2xl font-bold leading-none",
                runningBalance >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}>
                {format(Math.abs(runningBalance))}
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-right max-w-[180px]">
              {runningBalance >= 0
                ? `Business owes ${partnerName}`
                : `${partnerName} owes business`}
            </p>
          </div>
        )}

        {/* ── Transactions ── */}
        {displayRows.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-16 text-center">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-base font-semibold text-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Transactions will appear here once recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayRows.map((row: any, i: number) => (
              <div
                key={i}
                className="bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
              >
                {/* Direction icon */}
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  row.out
                    ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
                )}>
                  {row.out
                    ? <ArrowUpRight className="w-4 h-4" />
                    : <ArrowDownLeft className="w-4 h-4" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {eventLabel(row.event_type)}
                  </p>
                  {(row.metadata?.reason || row.metadata?.description) && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {row.metadata.reason || row.metadata.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtTs(row.created_at)}
                  </p>
                </div>

                {/* Amount + running balance */}
                <div className="text-right shrink-0">
                  <p className={cn(
                    "font-bold text-sm tabular-nums",
                    row.out
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {row.out ? "−" : "+"}{format(row.amount)}
                  </p>
                  <p className={cn(
                    "text-xs tabular-nums mt-0.5",
                    row.balance >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}>
                    Bal: {format(Math.abs(row.balance))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        </div>
      </main>
    </div>
  );
}
