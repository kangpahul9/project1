import { Sidebar } from "@/components/Sidebar";
import { useCurrency } from "@/hooks/use-currency";
import {
  useOrders,
  OrderItem,
  useOrderDetails,
  useOrderByBillNumber,
  useDeleteOrder,
  useRefundOrder,
} from "@/hooks/use-orders";
import {
  Loader2,
  Printer,
  ClipboardList,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card / EFTPOS",
  online: "UPI / Online",
  "mixed-card": "Cash + Card",
  "mixed-online": "Cash + UPI",
  unpaid: "Credit",
};

export default function Orders() {
  const { format } = useCurrency();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const ordersQuery = useOrders(false);
  const data = ordersQuery.data ?? [];
  const isLoading = ordersQuery.isLoading;

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const billSearch = search.toUpperCase().startsWith("BD-") ? search : undefined;
  const { data: searchedBill } = useOrderByBillNumber(billSearch);
  const { data: selectedOrder } = useOrderDetails(selectedOrderId ?? undefined);
  const { mutate: deleteOrder, isPending: isDeleting } = useDeleteOrder();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { mutate: refundOrder, isPending: isRefunding } = useRefundOrder();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState<number | null>(null);

  type RefundItem = { menu_item_id: number; qty: number };
  const [cashBreakdown, setCashBreakdown] = useState<{ note: number; qty: number }[]>([]);
  const [cashConfirmOpen, setCashConfirmOpen] = useState(false);
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [eftposConfirmOpen, setEftposConfirmOpen] = useState(false);

  const rawRefundTotal = refundItems.reduce<number>((sum, r) => {
    const item = selectedOrder?.items?.find((i) => i.menu_item_id === r.menu_item_id);
    if (!item) return sum;
    return sum + item.price_snapshot * r.qty;
  }, 0);
  const refundTotal = selectedOrder
    ? Math.min(rawRefundTotal, selectedOrder.amount_paid)
    : rawRefundTotal;

  let filteredOrders = data.filter((order) => {
    const query = search?.toLowerCase?.() || "";
    const matchesSearch =
      order.customer_name?.toLowerCase()?.includes(query) ||
      order.customer_phone?.includes(query) ||
      order.bill_number?.toLowerCase()?.includes(query);
    const orderDate = new Date(order.created_at).toLocaleDateString("en-CA");
    const matchesDate = dateFilter ? orderDate === dateFilter : true;
    return (query ? matchesSearch : true) && matchesDate;
  });

  if (searchedBill && !filteredOrders.some((o) => o.id === searchedBill.id)) {
    filteredOrders = [searchedBill as any, ...filteredOrders];
  }

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-0 lg:ml-60 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-primary shrink-0" />
            All Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"}
            {dateFilter && ` on ${new Date(dateFilter + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
          </p>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, phone, or bill number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative sm:w-48">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          {dateFilter && (
            <Button variant="outline" onClick={() => setDateFilter("")} className="shrink-0">
              Clear date
            </Button>
          )}
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin w-7 h-7 text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border/60 p-12 text-center">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground text-sm">No orders found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const isExpanded = selectedOrderId === order.id;
              return (
                <div
                  key={order.id}
                  className="bg-card rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 transition-all overflow-hidden"
                >
                  {/* Order row */}
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                          {order.bill_number}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                            order.is_paid
                              ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                          )}
                        >
                          {order.is_paid ? "Paid" : `Due ${format(order.due_amount)}`}
                        </span>
                      </div>

                      <p className="font-semibold text-foreground">
                        {order.customer_name || "Walk-in"}
                        {order.customer_phone && (
                          <span className="text-muted-foreground font-normal text-sm ml-2">
                            {order.customer_phone}
                          </span>
                        )}
                      </p>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString(undefined, {
                          month: "short", day: "numeric", year: "numeric"
                        })}
                        {" · "}
                        {new Date(order.created_at).toLocaleTimeString(undefined, {
                          hour: "2-digit", minute: "2-digit"
                        })}
                        {order.created_by_name && (
                          <span className="ml-1 opacity-70">· by {order.created_by_name}</span>
                        )}
                      </p>
                    </div>

                    {/* Right: amount + actions */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">{format(order.total)}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setSelectedOrderId(isExpanded ? null : order.id)}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded ? "Hide" : "Details"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/print/${order.bill_number}`, "_blank", "width=400,height=600")}
                        >
                          <Printer size={14} />
                        </Button>

                        {isAdmin && order.amount_paid > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setRefundOrderId(order.id);
                              setRefundOpen(true);
                            }}
                          >
                            <RotateCcw size={14} />
                          </Button>
                        )}

                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                            onClick={() => setDeleteId(order.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && selectedOrder && selectedOrder.id === order.id && (
                    <div className="mx-5 mb-5 bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
                      {/* Payment info row */}
                      <div className="flex flex-wrap gap-3 text-sm pb-3 border-b border-border/50">
                        <div>
                          <span className="text-muted-foreground text-xs block mb-0.5">Payment</span>
                          <span className="font-medium text-foreground capitalize">
                            {METHOD_LABELS[selectedOrder.payment_method] ?? selectedOrder.payment_method}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block mb-0.5">Paid</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {format(selectedOrder.amount_paid)}
                          </span>
                        </div>
                        {!selectedOrder.is_paid && (
                          <div>
                            <span className="text-muted-foreground text-xs block mb-0.5">Due</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {format(selectedOrder.due_amount)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Items list */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Items
                        </p>
                        <div className="space-y-1.5">
                          {selectedOrder.items.map((item: OrderItem) => (
                            <div
                              key={item.menu_item_id}
                              className="flex justify-between items-center text-sm"
                            >
                              <span className="text-foreground">
                                {item.item_name}
                                <span className="text-muted-foreground ml-1.5">× {item.quantity}</span>
                              </span>
                              <span className="font-semibold text-foreground tabular-nums">
                                {format(item.price_snapshot * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading skeleton for details */}
                  {isExpanded && !selectedOrder && (
                    <div className="mx-5 mb-5 bg-muted/30 rounded-xl border border-border/50 p-4 flex justify-center">
                      <Loader2 className="animate-spin w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </main>

      {/* ── DELETE DIALOG ── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <DialogTitle>Delete Order?</DialogTitle>
            </div>
            <DialogDescription>
              This will move the order to the deleted list. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isDeleting}
              onClick={() => {
                if (!deleteId) return;
                setDeletingId(deleteId);
                deleteOrder(deleteId, {
                  onSettled: () => {
                    setDeleteId(null);
                    setDeletingId(null);
                  },
                });
              }}
            >
              {isDeleting && deletingId === deleteId ? (
                <Loader2 className="animate-spin w-4 h-4 mr-2" />
              ) : null}
              {isDeleting && deletingId === deleteId ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── REFUND DIALOG ── */}
      <Dialog
        open={refundOpen}
        onOpenChange={(open) => {
          setRefundOpen(open);
          if (!open) { setRefundItems([]); setRefundOrderId(null); }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund Items</DialogTitle>
            {selectedOrder && (
              <DialogDescription>
                Payment method: {METHOD_LABELS[selectedOrder.payment_method] ?? selectedOrder.payment_method}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedOrder.items.map((item: OrderItem) => {
                const selected = refundItems.find((i) => i.menu_item_id === item.menu_item_id);
                return (
                  <div
                    key={item.menu_item_id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={!!selected}
                        onCheckedChange={(checked) => {
                          if (!checked) {
                            setRefundItems((prev) =>
                              prev.filter((p) => p.menu_item_id !== item.menu_item_id)
                            );
                          } else {
                            setRefundItems((prev) => [
                              ...prev,
                              { menu_item_id: item.menu_item_id, qty: 1 },
                            ]);
                          }
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">max {item.quantity}</p>
                      </div>
                    </div>

                    {selected && (
                      <Input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={selected.qty}
                        onChange={(e) => {
                          let qty = Number(e.target.value);
                          if (qty < 1) qty = 1;
                          if (qty > item.quantity) qty = item.quantity;
                          setRefundItems((prev) =>
                            prev.map((p) =>
                              p.menu_item_id === item.menu_item_id ? { ...p, qty } : p
                            )
                          );
                        }}
                        className="w-16 h-8 text-center"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          <div className="bg-muted/40 rounded-xl p-3 text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Items selected</span>
              <span>{refundItems.length}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-foreground border-t pt-1.5">
              <span>Total Refund</span>
              <span className="text-primary">{format(refundTotal)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setRefundOpen(false); setRefundItems([]); setRefundOrderId(null); }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={isRefunding || refundItems.length === 0 || refundTotal <= 0}
              onClick={() => {
                if (!refundOrderId) return;
                refundOrder(
                  {
                    orderId: refundOrderId,
                    items: refundItems.map((r) => ({ menu_item_id: r.menu_item_id, qty: r.qty })),
                  },
                  {
                    onSuccess: (res: any) => {
                      if (res.mode === "bank") { setEftposConfirmOpen(true); return; }
                      if (res.mode === "cash") {
                        setCashBreakdown(res.changeBreakdown || []);
                        setCashConfirmOpen(true);
                        return;
                      }
                    },
                  }
                );
              }}
            >
              {isRefunding ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
              {isRefunding ? "Processing…" : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EFTPOS REFUND DIALOG ── */}
      <Dialog open={eftposConfirmOpen} onOpenChange={setEftposConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>EFTPOS Refund Required</DialogTitle>
            <DialogDescription>
              Please process this refund on the EFTPOS machine.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEftposConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setEftposConfirmOpen(false);
                setRefundOpen(false);
                setRefundItems([]);
                setRefundOrderId(null);
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CASH REFUND DIALOG ── */}
      <Dialog open={cashConfirmOpen} onOpenChange={setCashConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Return Cash to Customer</DialogTitle>
            <DialogDescription>
              Give the following denominations to the customer:
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2 mt-2">
            {cashBreakdown.map((d) => (
              <div key={d.note} className="flex justify-between text-sm font-medium text-foreground">
                <span>{format(d.note)}</span>
                <span className="text-muted-foreground">× {d.qty}</span>
              </div>
            ))}
            <div className="border-t border-amber-200 dark:border-amber-700 pt-2 flex justify-between font-bold text-foreground">
              <span>Total</span>
              <span>{format(cashBreakdown.reduce((s, d) => s + d.note * d.qty, 0))}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCashConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setCashConfirmOpen(false);
                setRefundOpen(false);
                setRefundItems([]);
                setRefundOrderId(null);
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Cash Given
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
