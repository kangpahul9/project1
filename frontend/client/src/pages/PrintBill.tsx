import { useEffect } from "react";
import { useParams } from "wouter";
import { useOrderByBillNumber } from "@/hooks/use-orders";
import { useRestaurantInfo } from "@/hooks/use-restaurant";

export default function PrintBill() {
  const { billNumber } = useParams();
  const { data: order, isLoading } = useOrderByBillNumber(billNumber);
  const { data: restaurant } = useRestaurantInfo();

  useEffect(() => {
    if (order && restaurant) {
      setTimeout(() => {
        window.print();
        window.close();
      }, 500);
    }
  }, [order, restaurant]);

  if (isLoading || !order || !restaurant) return null;

  const currency = restaurant.currency || "₹";

  return (
    <div className="p-4 text-sm font-mono w-[80mm]">

      {/* HEADER */}
      <div className="text-center mb-3">
        <h2 className="font-bold text-lg">{restaurant.name}</h2>

        {restaurant.address && (
          <p className="text-xs">{restaurant.address}</p>
        )}

        {restaurant.phone && (
          <p className="text-xs">Phone: {restaurant.phone}</p>
        )}
      </div>

      {/* BILL INFO */}
      <div className="border-t border-b py-2 text-xs">
        <p>Bill: {order.bill_number}</p>
        <p>Date: {new Date(order.created_at).toLocaleString()}</p>
        <p>Payment: {order.payment_method}</p>
      </div>

      {/* ITEMS */}
      <div className="mt-3 space-y-1">
        {order?.items?.map((item: any, index: number) => {
          const lineTotal =
            Number(item.price_snapshot) * Number(item.quantity);

          return (
            <div
              key={index}
              className="flex justify-between"
            >
              <span>
                {item.item_name} x{Number(item.quantity)}
              </span>
              <span>{currency}{lineTotal}</span>
            </div>
          );
        })}
      </div>

      {/* TOTAL */}
      <div className="border-t mt-3 pt-2 flex justify-between font-bold">
        <span>Total</span>
        <span>{currency}{order.total}</span>
      </div>

      {/* FOOTER */}
      <div className="mt-3 text-center text-xs">
        {restaurant.receipt_footer}
      </div>

    </div>
  );
}