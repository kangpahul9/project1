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
      <div className="border-t border-b border-dashed py-2 text-xs">
        <p>Bill: {order.bill_number}</p>
        <p>Date: {new Date(order.created_at).toLocaleString()}</p>
        <p>Payment: {order.payment_method}</p>
      </div>

      {/* ITEMS */}
      <div className="mt-3 text-xs">

        {/* HEADER */}
        <div className="flex justify-between font-semibold border-b border-dashed pb-1">
          <span className="w-[40%]">Item</span>
          <span className="w-[20%] text-right">Price</span>
          <span className="w-[15%] text-right">Qty</span>
          <span className="w-[25%] text-right">Total</span>
        </div>

        {/* ITEMS LIST */}
        {order.items.map((item: any, index: number) => {
          const price = Number(item.price_snapshot);
          const qty = Number(item.quantity);
          const lineTotal = price * qty;

          return (
            <div key={index} className="flex justify-between py-1">

              <span className="w-[40%] truncate">
                {item.item_name}
              </span>

              <span className="w-[20%] text-right">
                {currency}{price}
              </span>

              <span className="w-[15%] text-right">
                {qty}
              </span>

              <span className="w-[25%] text-right">
                {currency}{lineTotal}
              </span>

            </div>
          );
        })}
      </div>

      {/* SEPARATOR */}
      <div className="border-t border-dashed my-2" />

      {/* TOTAL */}
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{currency}{order.total}</span>
      </div>

      {/* FOOTER */}
      <div className="mt-3 text-center text-[10px]">
        {restaurant.receipt_footer || "Thank you! Visit again 🙏"}

        <p className="mt-2 text-[8px] text-gray-500">Printed on KangPos </p>
      </div>


    </div>
  );
}