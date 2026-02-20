import { Sidebar } from "@/components/Sidebar";
import { useOrders, useOrderDetails } from "@/hooks/use-orders";
import { Loader2,Printer } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Orders() {
  const { data, isLoading } = useOrders();


  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data: selectedOrder } = useOrderDetails(selectedOrderId);

const filteredOrders =
  data?.filter((order: any) => {
    const query = search.toLowerCase();

    const matchesSearch =
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_phone?.includes(query) ||
      order.bill_number?.toLowerCase().includes(query);

    const matchesDate = dateFilter
      ? new Date(order.created_at)
          .toISOString()
          .split("T")[0] === dateFilter
      : true;

    return (query ? matchesSearch : true) && matchesDate;
  }) || [];

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <h1 className="text-2xl font-bold mb-6">
          All Orders
        </h1>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
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
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-lg">
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

                  <Button
                    variant="outline"
                    onClick={() =>
                      setSelectedOrderId(
                        selectedOrderId === order.id
                          ? null
                          : order.id
                      )
                    }
                  >
                    {selectedOrderId === order.id
                      ? "Hide Details"
                      : "View Details"}
                  </Button>
                  <Button
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
    </div>
  );
}
