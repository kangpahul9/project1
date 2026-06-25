import { Sidebar } from "@/components/Sidebar";
import { DeletedOrder, useDeletedOrders, useUndoDeleteOrder } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { format as formatDate } from "date-fns";

export default function DeletedOrders() {
  const { data, isLoading } = useDeletedOrders();
  const { mutate: undoDelete, isPending } = useUndoDeleteOrder();
  const { format } = useCurrency();
  const orders = data ?? [];

  const [restoringId, setRestoringId] = useState<number | null>(null);

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-8">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <Trash2 className="w-6 h-6 text-primary shrink-0" />
            Deleted Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Restore accidentally deleted orders
          </p>
        </div>

        {/* ── Count ── */}
        {!isLoading && orders.length > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            {orders.length} deleted order{orders.length !== 1 ? "s" : ""}
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-16 text-center shadow-sm">
            <Trash2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-foreground">No deleted orders</p>
            <p className="text-sm text-muted-foreground mt-1">Nothing to restore.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order: DeletedOrder) => (
              <div
                key={order.id}
                className="bg-card rounded-2xl p-4 sm:p-5 shadow-sm border border-border/60 hover:shadow-md hover:border-primary/20 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{order.bill_number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(new Date(order.created_at), "MMM d, yyyy · h:mm a")}
                  </p>
                  <p className="text-base font-bold text-foreground mt-2">
                    {format(order.total)}
                  </p>
                </div>

                <Button
                  variant="outline"
                  disabled={isPending && restoringId === order.id}
                  onClick={() => {
                    setRestoringId(order.id);
                    undoDelete(order.id, { onSettled: () => setRestoringId(null) });
                  }}
                  className="shrink-0 gap-2"
                >
                  {isPending && restoringId === order.id
                    ? <Loader2 className="animate-spin w-4 h-4" />
                    : <RotateCcw className="w-4 h-4" />}
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}

        </div>
      </main>
    </div>
  );
}
