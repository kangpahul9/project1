import { Sidebar } from "@/components/Sidebar";
import { useOrders } from "@/hooks/use-orders";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, Receipt } from "lucide-react";

export default function Orders() {
  const { data: currentDay } = useCurrentBusinessDay();
  const { data: orders, isLoading } = useOrders(currentDay?.id);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-3xl font-bold font-display text-gray-900 mb-6">Recent Orders</h1>

        {!currentDay && (
          <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg mb-6 border border-yellow-200">
            Business day is closed. Showing no active orders.
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4">
            {orders?.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Receipt className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Order #{order.id}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {order.customerName || "Walk-in Customer"} • {format(new Date(order.createdAt!), "h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={order.paymentMethod === 'cash' ? "outline" : "default"}>
                      {order.paymentMethod}
                    </Badge>
                    <span className="font-bold text-lg w-20 text-right">₹{order.totalAmount}</span>
                  </div>
                </CardHeader>
              </Card>
            ))}
            
            {orders?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No orders placed yet today.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
