import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  getKitchenTickets,
  markTicketReady,
  dismissTicket,
  getElapsedMinutes,
  useStorageSync,
  type KitchenTicket,
} from "@/hooks/use-tables";
import { ChefHat, CheckCircle2, X, Clock, RefreshCw, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ElapsedBadge({ sentAt }: { sentAt: string }) {
  const [mins, setMins] = useState(getElapsedMinutes(sentAt));

  useEffect(() => {
    const id = setInterval(() => setMins(getElapsedMinutes(sentAt)), 30_000);
    return () => clearInterval(id);
  }, [sentAt]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
        mins < 5
          ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
          : mins < 12
          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
          : "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
      )}
    >
      <Clock className="w-3 h-3" />
      {mins === 0 ? "Just now" : `${mins}m ago`}
    </span>
  );
}

function TicketCard({
  ticket,
  onReady,
  onDismiss,
}: {
  ticket: KitchenTicket;
  onReady: () => void;
  onDismiss: () => void;
}) {
  const isReady = ticket.status === "ready";

  return (
    <div
      className={cn(
        "rounded-2xl border shadow-sm flex flex-col overflow-hidden transition-all",
        isReady
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 opacity-70"
          : "border-border/60 bg-card hover:shadow-md"
      )}
    >
      {/* Header strip */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b",
          isReady
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-100/60 dark:bg-emerald-950/30"
            : "bg-muted/30"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
              isReady
                ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-primary/10 text-primary"
            )}
          >
            {ticket.tableNumber}
          </div>
          <div>
            <p className="font-bold text-foreground text-sm leading-tight">
              Table {ticket.tableNumber}
            </p>
            <p className="text-xs text-muted-foreground">
              {ticket.items.reduce((s, i) => s + i.quantity, 0)} items
            </p>
          </div>
        </div>
        <ElapsedBadge sentAt={ticket.sentAt} />
      </div>

      {/* Items */}
      <div className="px-4 py-3 flex-1 space-y-1.5">
        {ticket.items.map((item, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2">
            <span className="text-foreground text-sm font-medium leading-snug">
              {item.name}
            </span>
            <span className="shrink-0 text-sm font-bold text-primary tabular-nums">
              ×{item.quantity}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 pt-1 flex gap-2">
        {isReady ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="w-3.5 h-3.5" />
            Dismiss
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onReady}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Mark Ready
          </Button>
        )}
        {!isReady && (
          <Button size="sm" variant="ghost" onClick={onDismiss} className="px-2.5 text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function KDS() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const refresh = useCallback(() => {
    setTickets(getKitchenTickets());
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useStorageSync(refresh);

  const pending = tickets.filter(t => t.status === "pending");
  const ready = tickets.filter(t => t.status === "ready");

  const handleReady = (ticketId: string) => {
    markTicketReady(ticketId);
    refresh();
  };

  const handleDismiss = (ticketId: string) => {
    dismissTicket(ticketId);
    refresh();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 lg:ml-60 flex flex-col min-h-screen">

        {/* ── Header ── */}
        <div className="border-b bg-card px-6 pt-5 pb-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Kitchen Display</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pending.length} order{pending.length !== 1 ? "s" : ""} pending
                · refreshed {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        <div className="flex-1 p-6 space-y-8">

          {/* ── Empty state ── */}
          {tickets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                <Utensils className="w-7 h-7 opacity-40" />
              </div>
              <p className="font-semibold text-foreground">No active orders</p>
              <p className="text-sm mt-1">Orders sent from the POS Dine-In mode will appear here.</p>
            </div>
          )}

          {/* ── Pending orders ── */}
          {pending.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Preparing · {pending.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {pending
                  .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
                  .map(t => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      onReady={() => handleReady(t.id)}
                      onDismiss={() => handleDismiss(t.id)}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* ── Ready orders ── */}
          {ready.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Ready to serve · {ready.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {ready.map(t => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    onReady={() => handleReady(t.id)}
                    onDismiss={() => handleDismiss(t.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
