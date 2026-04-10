import { Sidebar } from "@/components/Sidebar";
import { useOrders, useOrderDetails,useOrderByBillNumber,useDeleteOrder } from "@/hooks/use-orders";
import { Loader2,Printer,Trash2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Orders() {
  const { user } = useAuthStore();
const isAdmin = user?.role === "ADMIN";
  const { data, isLoading } = useOrders();


  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const billSearch =
  search.toUpperCase().startsWith("BD-") ? search : undefined;
  const { data: searchedBill } = useOrderByBillNumber(billSearch);
  const { data: selectedOrder } = useOrderDetails(selectedOrderId);
const { mutate: deleteOrder, isPending: isDeleting } = useDeleteOrder();
const [deleteId, setDeleteId] = useState<number | null>(null);



let filteredOrders =
  data?.filter((order: any) => {
    const query = search.toLowerCase();

    const matchesSearch =
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_phone?.includes(query) ||
      order.bill_number?.toLowerCase().includes(query);

    const matchesDate = dateFilter
      ? new Date(order.created_at).toISOString().split("T")[0] === dateFilter
      : true;

    return (query ? matchesSearch : true) && matchesDate;
  }) || [];

// If searching bill number and API returned result
if (searchedBill && !filteredOrders.find((o: any) => o.id === searchedBill.id)) {
  filteredOrders = [searchedBill, ...filteredOrders];
}

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

<main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          <h1 className="text-2xl font-bold mb-6">
          All Orders
        </h1>

        {/* Filters */}
<div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
placeholder="Search by name, phone, or bill number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white p-6 rounded shadow text-center">
            No orders found.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order: any) => (
              <div
                key={order.id}
                className="bg-white p-6 rounded-xl shadow border"
              >
<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                    <div className="font-semibold text-base sm:text-lg break-words">
                      {order.bill_number} — {order.customer_name || "Walk-in"}
                    </div>

                    <div className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()} •{" "}
                      {new Date(order.created_at).toLocaleTimeString()}
                    </div>

                    <div className="mt-2 font-semibold">
                      ₹{order.total}
                    </div>

                    <div
                      className={`text-sm font-semibold ${
                        order.is_paid
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {order.is_paid
                        ? "Paid"
                        : `Due: ₹${order.due_amount}`}
                    </div>
                  </div>

                 <div className="flex flex-wrap gap-2">
  <Button className="w-full text-gray-600"
    variant="outline"
    onClick={() =>
      setSelectedOrderId(
        selectedOrderId === order.id ? null : order.id
      )
    }
  >
    {selectedOrderId === order.id
      ? "Hide Details"
      : "View Details"}
  </Button>

  <Button className="w-full text-green-600"
    size="sm"
    variant="secondary"
    onClick={() =>
      window.open(
        `/print/${order.bill_number}`,
        "_blank",
        "width=400,height=600"
      )
    }
  >
    <Printer className="w-4 h-4 mr-2" />
    Print
  </Button>

  {/* 🔥 DELETE BUTTON */}
  {isAdmin && (
    <Button className="w-full"
  variant="destructive"
  onClick={() => setDeleteId(order.id)}
>
  Delete
</Button>
  )}
</div>

                </div>

                {selectedOrderId === order.id && selectedOrder && (
                  <div className="mt-4 border-t pt-4 space-y-2 text-sm">
                    <div>
                      Payment Method: {selectedOrder.payment_method}
                    </div>

                    <div>
                      Paid: ₹{selectedOrder.amount_paid}
                    </div>

                    {!selectedOrder.is_paid && (
                      <div className="text-red-600 font-semibold">
                        Due: ₹{selectedOrder.due_amount}
                      </div>
                    )}

                    <div className="mt-3 font-semibold">Items:</div>

                    {selectedOrder.items.map((item: any) => (
                      <div
                        key={item.menu_item_id}
                        className="flex justify-between"
                      >
                        <span>
                          {item.item_name} × {item.quantity}
                        </span>
                        <span>
                          ₹{item.price_snapshot * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle className="text-red-600">Delete Order?</DialogTitle>
      <DialogDescription>
        This will move the order to deleted list. You can restore it later.
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setDeleteId(null)}
      >
        Cancel
      </Button>

      <Button
        className="bg-red-600 text-white"
        disabled={isDeleting}
        onClick={() => {
          if (!deleteId) return;

          deleteOrder(deleteId, {
            onSuccess: () => setDeleteId(null),
          });
        }}
      >
        {isDeleting ? "Deleting..." : "Confirm Delete"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </div>
  );
}
