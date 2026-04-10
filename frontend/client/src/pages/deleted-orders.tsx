import { Sidebar } from "@/components/Sidebar";
import {
  useDeletedOrders,
  useUndoDeleteOrder,
} from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";

export default function DeletedOrders() {
  const { data, isLoading } = useDeletedOrders();
  const { mutate: undoDelete, isPending } = useUndoDeleteOrder();

  const [restoringId, setRestoringId] = useState<number | null>(null);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

<main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
  <div className="mx-auto">        <h1 className="text-2xl font-bold mb-6">
          Deleted Orders
        </h1>
        <p className="text-sm text-gray-500 mb-6">
  Restore accidentally deleted orders
</p>


<div className="mb-4 text-sm text-gray-500">
  {data?.length || 0} deleted orders
</div>
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : data?.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl shadow-sm border text-center">
  <p className="text-gray-500">No deleted orders</p>
</div>
        ) : (
          <div className="space-y-4">
            {data.map((order: any) => (
             <div
  key={order.id}
className="bg-white rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  {/* LEFT */}
  <div>
    <p className="font-semibold text-sm sm:text-base lg:text-lg">
      {order.bill_number}
    </p>

    <p className="text-xs sm:text-sm text-gray-500">
      {new Date(order.created_at).toLocaleDateString()} •{" "}
      {new Date(order.created_at).toLocaleTimeString()}
    </p>

    <p className="mt-2 text-sm sm:text-base font-bold">
      ₹{order.total}
    </p>
  </div>

  {/* RIGHT */}
  <Button
    disabled={isPending && restoringId === order.id}
    onClick={() => {
      setRestoringId(order.id);
      undoDelete(order.id, {
        onSettled: () => setRestoringId(null),
      });
    }}
    className="bg-black hover:bg-gray-900 text-white 
               text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2"
  >
    {isPending && restoringId === order.id ? (
      <Loader2 className="animate-spin w-4 h-4" />
    ) : (
      <>
        <RotateCcw className="w-4 h-4" />
        Restore
      </>
    )}
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