import { Sidebar } from "@/components/Sidebar";
import { useUnpaidOrders } from "@/hooks/use-unpaid-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CreditCard, Search } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { format as formatDate } from "date-fns";
import { cn } from "@/lib/utils";

export default function UnpaidOrders() {
  const { data, isLoading } = useUnpaidOrders();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const { format } = useCurrency();

  const filteredOrders =
    data?.filter((order: any) =>
      order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_phone?.includes(search)
    ) || [];

  const totalDue = filteredOrders.reduce((s: number, o: any) => s + Number(o.due_amount), 0);

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-8">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-primary shrink-0" />
            Unpaid Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orders with outstanding balances
          </p>
        </div>

        {/* ── Search + count ── */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by customer name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Summary strip ── */}
        {!isLoading && filteredOrders.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Orders</p>
              <p className="text-2xl font-bold text-foreground">{filteredOrders.length}</p>
            </div>
            <div className="bg-card border border-red-200 dark:border-red-800 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">Total Due</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{format(totalDue)}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-16 text-center shadow-sm">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-foreground">No unpaid orders 🎉</p>
            <p className="text-sm text-muted-foreground mt-1">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order: any) => {
              const due = Number(order.due_amount);
              return (
                <div
                  key={order.id}
                  className="bg-card rounded-2xl p-4 sm:p-5 shadow-sm border border-border/60 hover:shadow-md hover:border-red-200 dark:hover:border-red-800 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground truncate">
                        {order.customer_name || "Walk-in Customer"}
                      </p>
                      {order.customer_phone && (
                        <span className="text-xs text-muted-foreground shrink-0">{order.customer_phone}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(new Date(order.created_at), "MMM d, yyyy · h:mm a")}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-muted-foreground">
                        Paid {format(order.amount_paid)} / {format(order.total)}
                      </span>
                      <span className={cn(
                        "text-sm font-bold",
                        due > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {format(due)} due
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(`/pos?pay=${order.id}`)}
                    className="shrink-0"
                  >
                    Pay Now
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        </div>
      </main>
    </div>
  );
}
