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

      <main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-6">
  Unpaid Orders
</h1>
        {/* 🔎 Search Input */}
        <div className="mb-6">
          <Input
          className="h-10 sm:h-11 lg:h-12 text-sm sm:text-base lg:text-lg"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mb-4 text-sm text-gray-500">
  {filteredOrders.length} unpaid orders
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
className="bg-white rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm border flex justify-between items-center">
  {/* LEFT */}
  <div>
    <p className="font-semibold text-sm sm:text-base lg:text-lg">
      {order.customer_name || "Walk-in Customer"}
    </p>

    <p className="text-xs lg:text-lg sm:text-sm text-gray-500">
      {new Date(order.created_at).toLocaleDateString()} •{" "}
      {new Date(order.created_at).toLocaleTimeString()}
    </p>

    <div className="mt-2 text-xs lg:text-lg sm:text-sm text-gray-500">
      Paid ₹{order.amount_paid} / ₹{order.total}
    </div>

    <p className="text-sm sm:text-base lg:text-lg font-bold text-red-600 mt-1">
      ₹{order.due_amount} due
    </p>
  </div>

  {/* RIGHT */}
  <Button
    onClick={() => navigate(`/pos?pay=${order.id}`)}
    className="bg-green-600 hover:bg-green-700 text-white 
             text-xs sm:text-sm lg:text-base 
             px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg">
    Pay Now
  </Button>
</div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
