import { Sidebar } from "@/components/Sidebar";
import { useUnpaidOrders } from "@/hooks/use-unpaid-orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

export default function UnpaidOrders() {
  const { data, isLoading } = useUnpaidOrders();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  // 🔎 Filter orders by name OR phone
  const filteredOrders =
    data?.filter((order: any) =>
      order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_phone?.includes(search)
    ) || [];

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <h1 className="text-2xl font-bold mb-6">Unpaid Orders</h1>

        {/* 🔎 Search Input */}
        <div className="mb-6">
          <Input
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white p-6 rounded shadow text-center">
            No unpaid orders 🎉
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order: any) => (
              <div
                key={order.id}
                className="bg-white rounded-xl p-6 shadow border"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-lg">
                      {order.customer_name || "Walk-in Customer"}
                    </div>

                    <div className="text-sm text-gray-500">
                      {order.customer_phone || "-"}
                    </div>

                    {/* 🕒 Date + Time */}
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(order.created_at).toLocaleDateString()} •{" "}
                      {new Date(order.created_at).toLocaleTimeString()}
                    </div>

                    <div className="mt-2 text-sm">
                      Total: ₹{order.total}
                    </div>

                    <div className="text-sm">
                      Paid: ₹{order.amount_paid}
                    </div>

                    <div className="text-sm font-bold text-red-500">
                      Due: ₹{order.due_amount}
                    </div>
                  </div>

                  <Button
                    onClick={() => navigate(`/pos?pay=${order.id}`)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Mark Paid
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
