import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  useMenu,
  useMenuCategories,
  useCreateMenuItem,
  useDeleteMenuItem,
  useUpdateMenuItem,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/use-menu";
import { useCreateOrder } from "@/hooks/use-orders";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { useAuthStore } from "@/hooks/use-auth";
import { MenuItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Wifi,
  Banknote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useMarkOrderPaid, useUnpaidOrders } from "@/hooks/use-unpaid-orders";
import { useOrderById } from "@/hooks/use-unpaid-orders";
import { useEffect } from "react";
import { DenominationSelector } from "@/components/DenominationSelector";
import { useSettings } from "@/hooks/use-settings";
import QRCode from "qrcode";

interface CartItem extends MenuItem {
  quantity: number;
}

export default function Pos() {
  const [location, navigate] = useLocation();
  const { data: settings } = useSettings();

  // 🔥 Use real browser search params
  const searchParams = new URLSearchParams(window.location.search);
  const unpaidOrderId = searchParams.get("pay");
  const isUnpaidPayment = !!unpaidOrderId;

  const { data: unpaidOrder, isLoading: unpaidLoading } =
    useOrderById(unpaidOrderId);
  const [upiQr, setUpiQr] = useState<string | null>(null);

  const { data: menuItems, isLoading } = useMenu();
  // const popularItems =
  // menuItems
  //   ?.slice()
  //   .sort((a: any, b: any) => (b.usage_count || 0) - (a.usage_count || 0))
  //   .slice(0, 8) || [];
  const { data: categories } = useMenuCategories();
  const { data: currentDay } = useCurrentBusinessDay();
  const { user } = useAuthStore();
  const { mutate: createOrder, isPending } = useCreateOrder();
  const { mutate: markPaid } = useMarkOrderPaid();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [latestBill, setLatestBill] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">(
    "all",
  );
  const { mutate: createMenuItem } = useCreateMenuItem();
  const { mutate: deleteMenuItem } = useDeleteMenuItem();
  const { mutate: updateMenuItem } = useUpdateMenuItem();

  const { mutate: createCategory } = useCreateCategory();
  const { mutate: deleteCategory } = useDeleteCategory();
  const { mutate: updateCategory } = useUpdateCategory();

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const [menuItemDialogOpen, setMenuItemDialogOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<any | null>(null);

  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formCategory, setFormCategory] = useState<number | null>(null);
  const [formColor, setFormColor] = useState("#6366f1");

  const [paymentMode, setPaymentMode] = useState<
    "cash" | "upi" | "eftpos" | "unpaid" | "mixed-card" | "mixed-online" | null
  >(null);
  const [customerName, setCustomerName] = useState("");
  const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];
  const NOTE_COLORS: Record<number, string> = {
    500: "bg-amber-400",
    200: "bg-orange-400",
    100: "bg-purple-400",
    50: "bg-blue-400",
    20: "bg-green-400",
    10: "bg-yellow-400",
    5: "bg-gray-300",
    2: "bg-gray-400",
    1: "bg-gray-500",
  };

  const [discount, setDiscount] = useState(0);

  const [customerPhone, setCustomerPhone] = useState("");
  const [partialAmount, setPartialAmount] = useState(0);
  const [editingQty, setEditingQty] = useState<Record<number, string>>({});

  const [cashBreakdown, setCashBreakdown] = useState(
    DENOMS.map((d) => ({ note: d, qty: 0 })),
  );

  const [isWeightBased, setIsWeightBased] = useState(false);

  const [pendingChange, setPendingChange] = useState<any[]>([]);
  const [awaitingChangeConfirm, setAwaitingChangeConfirm] = useState(false);

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printBillNumber, setPrintBillNumber] = useState<string | null>(null);
  const [menuAdminOpen, setMenuAdminOpen] = useState(false);

  const subtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  // Prefill cart when settling unpaid
  useEffect(() => {
    if (isUnpaidPayment && unpaidOrder?.items) {
      setCart(
        unpaidOrder.items.map((item: any) => ({
          id: item.menu_item_id,
          name: item.item_name,
          price: Number(item.price_snapshot),
          quantity: Number(item.quantity),
        })),
      );

      setCustomerName(unpaidOrder.customer_name || "");
      setCustomerPhone(unpaidOrder.customer_phone || "");
    }
  }, [unpaidOrder, isUnpaidPayment]);

  // Auto-fill returning customer from localStorage
  useEffect(() => {
    if (customerPhone.length >= 8) {
      const lastCustomer = JSON.parse(
        localStorage.getItem("lastCustomer") || "null",
      );

      if (lastCustomer?.phone === customerPhone) {
        setCustomerName(lastCustomer.name);
      }
    }
  }, [customerPhone]);

  const cartTotal = isUnpaidPayment
    ? unpaidOrder?.due_amount || 0
    : Math.max(0, subtotal - discount);
  /* ===============================
     ADD TO CART
  =============================== */
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };
  const adjustNote = (note: number, delta: number) => {
    setCashBreakdown((prev) =>
      prev.map((n) =>
        n.note === note ? { ...n, qty: Math.max(0, n.qty + delta) } : n,
      ),
    );
  };

  const totalReceived = cashBreakdown.reduce(
    (sum, n) => sum + n.note * n.qty,
    0,
  );


  useEffect(() => {
    if (!paymentDialog) setUpiQr(null);
  }, [paymentDialog]);

  const remainingAmount = Math.max(0, cartTotal - totalReceived);

  const updateQuantity = (id: number, delta: number) => {
  setCart(prev =>
    prev
      .map(item =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(0, item.quantity + delta)
            }
          : item
      )
      .filter(item => item.quantity > 0)
  );
};

  useEffect(() => {
    if (paymentMode === "upi") {
      QRCode.toDataURL(generateUpiLink())
        .then(setUpiQr)
        .catch(() => setUpiQr(null));
    }
  }, [paymentMode, cartTotal, totalReceived, remainingAmount, settings]);

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  /* ===============================
     GENERATE REAL UPI LINK
  =============================== */
  const generateUpiLink = () => {
  if (!settings?.upi_id) return "";

  const upiId = settings.upi_id;// change later
    const name = "My Restaurant";
    const amount =
      totalReceived > 0 ? remainingAmount.toFixed(2) : cartTotal.toFixed(2);
    const note = "POS Payment";

    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      name,
    )}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  };

  /* ===============================
     COMPLETE ORDER
  =============================== */
  const completeOrder = (method: "cash" | "upi" | "eftpos" | "unpaid") => {
    if (!currentDay || !user) return;



    /* ===============================
     UNPAID ORDER SETTLEMENT FLOW
  =============================== */
    if (isUnpaidPayment && unpaidOrder) {
      let payAmount = 0;

      if (method === "cash") {
        payAmount = totalReceived;
        if (payAmount <= 0) {
          toast({
            title: "Enter cash received",
            variant: "destructive",
          });
          return;
        }
      }

      
      if (method === "upi" || method === "eftpos") {
        payAmount = unpaidOrder.due_amount;
      }

      markPaid(
        {
          id: unpaidOrder.id,
          payAmount,
          paymentMethod:
            method === "upi" ? "online" : method === "eftpos" ? "card" : "cash",
          cashBreakdown: method === "cash" ? cashBreakdown : undefined,
        },
        {
          onSuccess: (data: any) => {
            setLatestBill(data.bill_number);

            if (method === "cash" && data.changeBreakdown?.length > 0) {
              setPendingChange(data.changeBreakdown);
              setAwaitingChangeConfirm(true);
              return;
            }

            finalizeSale(data.bill_number);
          },
          onError: (err: any) => {
            toast({
              title: "Payment Failed",
              description: err.message,
              variant: "destructive",
            });
          },
        },
      );

      return;
    }

    /* ===============================
     NORMAL NEW ORDER FLOW
  =============================== */

    if (method === "cash") {
      if (totalReceived < cartTotal) {
        toast({
          title: "Insufficient Cash",
          description: "Customer payment is less than total.",
          variant: "destructive",
        });
        return;
      }
    }

    if (method === "unpaid") {
      if (!customerName || !customerPhone) {
        toast({
          title: "Missing Details",
          description: "Customer name and phone required.",
          variant: "destructive",
        });
        return;
      }

      // Allow ₹0 or partial
      if (totalReceived > cartTotal) {
        toast({
          title: "Invalid Amount",
          description: "Partial cannot exceed total.",
          variant: "destructive",
        });
        return;
      }

      // Prevent full payment via credit
      if (totalReceived === cartTotal && cartTotal > 0) {
        toast({
          title: "Use normal payment",
          description: "Full payment should use Cash/UPI/Card.",
          variant: "destructive",
        });
        return;
      }
    }

    createOrder(
      {
        businessDayId: currentDay.id,
        userId: user.id,
        customerName,
        customerPhone,
        paymentMethod:
          totalReceived > 0 && method === "eftpos"
            ? "mixed-card"
            : totalReceived > 0 && method === "upi"
              ? "mixed-online"
              : method === "upi"
                ? "online"
                : method === "eftpos"
                  ? "card"
                  : method,
        cashBreakdown: totalReceived > 0 ? cashBreakdown : null,
        discount,
        amountPaid: method === "unpaid" ? totalReceived : undefined,
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: Number(item.quantity),
          price: item.price,
          name: item.name,
        })),
      },
      {
        onSuccess: (data: any) => {
          setLatestBill(data.bill_number);

          if (method === "cash" && data.changeBreakdown?.length > 0) {
            setPendingChange(data.changeBreakdown);
            setAwaitingChangeConfirm(true);
            return;
          }

          finalizeSale(data.bill_number);
        },
        onError: (err: any) => {
          toast({
            title: "Payment Failed",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  /* ===============================
     HANDLE CHECKOUT
  =============================== */
  const handleCheckout = (method: any) => {
    setCheckoutOpen(false);
    setPaymentMode(method);
    setPaymentDialog(true);
  };

  const finalizeSale = (billNumber?: string) => {
    if (isUnpaidPayment) {
      navigate("/pos");
    }
    if (customerPhone && customerName) {
      localStorage.setItem(
        "lastCustomer",
        JSON.stringify({
          phone: customerPhone,
          name: customerName,
        }),
      );
    }

    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setPartialAmount(0);
    setDiscount(0);
    setCheckoutOpen(false);
    setPaymentDialog(false);
    setPendingChange([]);
    setAwaitingChangeConfirm(false);
    setCashBreakdown(DENOMS.map((d) => ({ note: d, qty: 0 })));

    let safeBill =
      typeof billNumber === "string"
        ? billNumber
        : billNumber?.bill_number || undefined;

    if (safeBill) {
      setPrintBillNumber(safeBill);
      setPrintDialogOpen(true);
    }

    toast({
      title: "Payment Successful",
      description: safeBill ? `Bill: ${safeBill}` : undefined,
      className: "bg-green-600 text-white border-none",
    });
  };

  // 🔥 SHOW LOADER WHEN REOPENING UNPAID ORDER
  if (isUnpaidPayment && unpaidLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!currentDay) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 flex items-center justify-center">
          <div>
            <h2 className="text-xl font-bold">Business Closed</h2>
            <p className="text-gray-500">Open a new business day first.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row bg-gray-50 h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-4 sm:p-6 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />

            <Input
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>

          {user?.role === "ADMIN" && (
            <Button
              className="h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4"
              onClick={() => setMenuAdminOpen(true)}
            >
              Manage Menu
            </Button>
          )}
        </div>

        {/* CATEGORY TABS */}
        <div className="flex gap-2 overflow-x-auto mb-6 pb-2">
          <Button
            className={`rounded-full px-5 py-2 text-sm ${
              selectedCategory === "all"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            onClick={() => setSelectedCategory("all")}
          >
            All
          </Button>

          {categories?.map((cat: any) => (
            <Button
              key={cat.id}
              className="rounded-full px-5 py-2 text-sm transition-all hover:scale-105"
              style={{
                background: selectedCategory === cat.id ? cat.color : "#f3f4f6",
                color: selectedCategory === cat.id ? "white" : "#374151",
              }}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>
        <ScrollArea className="flex-1 w-full overflow-y-auto">
          {/* 🔥 Popular Items

{popularItems.length > 0 && (
  <div className="mb-6">

    <h3 className="text-sm font-semibold text-purple-600 mb-3">
      🔥 Popular
    </h3>

    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">

      {popularItems.map((item: any) => (

        <div
          key={`popular-${item.id}`}
          onClick={() => addToCart(item)}
          className="rounded-xl bg-purple-100 hover:bg-purple-200 transition cursor-pointer p-3"
        >

          <p className="text-sm font-medium text-gray-800">
            {item.name}
          </p>

          <p className="text-xs text-purple-700 font-semibold">
            ₹{item.price}
          </p>
          

        </div>

      ))}

    </div>

  </div>
)} */}
          <div
            className="grid w-full
  grid-cols-2
  sm:grid-cols-3
  md:grid-cols-4
  lg:grid-cols-5
  xl:grid-cols-6
  gap-4 pb-10"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              menuItems
                ?.filter((item: any) => {
                  const searchMatch = item.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase());

                  const categoryMatch =
                    selectedCategory === "all" ||
                    item.category_id === selectedCategory;

                  return searchMatch && categoryMatch;
                })
                .sort(
                  (a: any, b: any) =>
                    (b.usage_count || 0) - (a.usage_count || 0),
                )
                .map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    role="button"
                    className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition cursor-pointer bg-white"
                  >
                    <div
                      className="h-24"
                      style={{
                        background: `linear-gradient(135deg, ${
                          categories?.find(
                            (c: any) => c.id === item.category_id,
                          )?.color || "#e5e7eb"
                        }, ${
                          categories?.find(
                            (c: any) => c.id === item.category_id,
                          )?.color + "cc" || "#e5e7eb"
                        })`,
                      }}
                    />

                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">
                          {item.name}
                        </p>

                        <p className="text-blue-600 font-bold text-sm">
                          ₹{item.price}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </ScrollArea>
      </main>

      {/* CART */}
      <aside className="w-full lg:w-[380px] xl:w-[420px] bg-white border-t lg:border-l flex flex-col shrink-0 h-full overflow-hidden">
        {" "}
        {isUnpaidPayment && unpaidOrder && (
          <div className="bg-amber-100 border border-amber-300 p-3 text-amber-800 text-sm">
            Settling Unpaid Order #{unpaidOrder.id}
          </div>
        )}
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="font-bold text-2xl flex items-center gap-3">
            <ShoppingCart size={22} />
            Current Order
          </h2>

          <div className="border rounded-full px-4 py-1 text-sm text-gray-600">
            {cart.length} items
          </div>
        </div>
        <ScrollArea className="flex-1 p-4 overflow-y-auto">
          {cart.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 mb-4 p-4 rounded-2xl border bg-white shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-lg font-semibold text-gray-800">
                  {item.name}
                </p>

                <p className="text-blue-600 text-xl font-bold">₹{item.price}</p>
              </div>

              <div className="flex items-center justify-center gap-3 w-32 bg-gray-100 px-3 py-2 rounded-xl">

  <button
    onClick={() => updateQuantity(item.id, -1)}
    className="text-lg font-bold px-2"
  >
    −
  </button>

  <input
  type="text"
  value={
    editingQty[item.id] !== undefined
      ? editingQty[item.id]
      : String(item.quantity)
  }
  onFocus={() => {
    setEditingQty(prev => ({
      ...prev,
      [item.id]: String(item.quantity)
    }));
  }}
  onChange={(e) => {
    const value = e.target.value;

    if (!/^\d*\.?\d*$/.test(value)) return;

    setEditingQty(prev => ({
      ...prev,
      [item.id]: value
    }));
  }}
  onBlur={() => {
    const value = editingQty[item.id];

    if (value === undefined) return;

    const num = Number(value);

    setCart(prev =>
      prev.map(i =>
        i.id === item.id
          ? {
              ...i,
              quantity: item.is_weight_based
                ? Math.max(0.01, num || 0)
                : Math.max(1, Math.floor(num || 0))
            }
          : i
      )
    );

    // cleanup
    setEditingQty(prev => {
      const copy = { ...prev };
      delete copy[item.id];
      return copy;
    });
  }}
  className="w-14 text-center font-semibold bg-transparent outline-none tabular-nums"
/>

  <button
    onClick={() => updateQuantity(item.id, 1)}
    className="w-6 text-center text-lg font-bold"
  >
    +
  </button>

</div>

{/* REMOVE BUTTON */}
<button
  onClick={() => removeFromCart(item.id)}
  className="text-red-500 hover:text-red-700"
>
  <Trash2 size={18} />
</button>
            </div>
          ))}
        </ScrollArea>
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm text-gray-600">Discount</span>
          <Input
            type="number"
            min={0}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="w-24 h-8"
          />
        </div>
        <div className="space-y-2 px-4 pr-6">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="text-right w-24">₹{subtotal}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Discount</span>
              <span className="text-right w-24">- ₹{discount}</span>
            </div>
          )}

          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total</span>
            <span className="text-right w-24">₹{cartTotal}</span>
          </div>

          <Button
            className="w-full mt-4 h-12 text-lg font-semibold bg-green-600 hover:bg-green-700"
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            Checkout
          </Button>
        </div>
      </aside>

      {/* PAYMENT METHOD SELECT */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <Button onClick={() => handleCheckout("cash")}>
              <Banknote className="mr-2" /> Cash
            </Button>

            <Button onClick={() => handleCheckout("upi")}>
              <Wifi className="mr-2" /> UPI
            </Button>

            <Button onClick={() => handleCheckout("eftpos")}>Card</Button>

            {!isUnpaidPayment && (
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => handleCheckout("unpaid")}
              >
                Credit
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* PAYMENT DIALOG */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="w-[95vw] max-w-4xl">
          <DialogHeader>
            {/* CUSTOMER SECTION */}
            <div className="mb-4 border-b pb-4">
              <div className="text-sm font-semibold mb-2">
                Customer Information
              </div>

              <Input
                placeholder="Customer Phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mb-2"
              />

              <Input
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />

              {paymentMode === "unpaid" && (
                <div className="text-xs text-red-500 mt-1">
                  Required for credit orders
                </div>
              )}
            </div>

            <DialogTitle>
              {paymentMode === "cash" && "Cash Payment"}
              {paymentMode === "upi" && "Scan & Pay (UPI)"}
              {paymentMode === "eftpos" && "EFTPOS Terminal"}
              {paymentMode === "unpaid" && "Credit / Unpaid Order"}
            </DialogTitle>
          </DialogHeader>

          {paymentMode === "cash" &&
            (awaitingChangeConfirm ? (
              /* ================= CHANGE RETURN UI ================= */
              <div className="space-y-6 text-center">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                  <h3 className="font-bold text-xl text-amber-700 mb-4">
                    Return Change
                  </h3>

                  <div className="space-y-2">
                    {pendingChange.map((c: any) => (
                      <div
                        key={c.note_value}
                        className="text-lg font-semibold text-gray-800"
                      >
                        ₹{c.note_value} × {c.quantity}
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => finalizeSale(latestBill || undefined)}
                >
                  Change Given ✔
                </Button>
              </div>
            ) : (
              /* ================= CASH ENTRY UI ================= */
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="text-xl font-bold">₹{cartTotal}</div>

                  <div className="text-sm text-gray-500 mt-3">Received</div>
                  <div className="text-2xl font-bold text-green-600">
                    ₹{totalReceived}
                  </div>

                  {/* 🔥 ADD THIS RIGHT HERE */}
                  {totalReceived > cartTotal && (
                    <div className="text-sm text-amber-600 mt-2 font-semibold">
                      Change: ₹{totalReceived - cartTotal}
                    </div>
                  )}
                </div>

                <div className="max-h-[45vh] overflow-y-auto">
                  <DenominationSelector
                    breakdown={cashBreakdown}
                    setBreakdown={setCashBreakdown}
                    title="Cash Received"
                  />
                </div>

                {remainingAmount === 0 ? (
                  <Button
                    className="w-full mt-4"
                    disabled={totalReceived === 0}
                    onClick={() => completeOrder("cash")}
                  >
                    Confirm Payment
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-center text-sm text-amber-600 font-semibold">
                      Remaining ₹{remainingAmount}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        className="bg-blue-600 text-white"
                        onClick={() => setPaymentMode("eftpos")}
                      >
                        Pay Remaining with Card
                      </Button>

                      <Button
                        className="bg-purple-600 text-white"
                        onClick={() => setPaymentMode("upi")}
                      >
                        Pay Remaining with UPI
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

          {paymentMode === "upi" && (
            <div className="space-y-6 text-center">
              <div className="text-sm text-gray-500">Total Amount</div>

              <div className="text-2xl font-bold">
                ₹{totalReceived > 0 ? remainingAmount : cartTotal}
              </div>

              {upiQr && (
                <div className="flex justify-center">
                  <img
                    src={upiQr}
                    alt="UPI QR"
                    className="w-56 h-56 border rounded-xl shadow"
                  />
                </div>
              )}

              <div className="text-sm text-gray-500">
                Ask customer to scan and complete payment.
                <br />
                Confirm after verifying bank screenshot.
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => completeOrder("upi")}
              >
                Confirm Payment
              </Button>
            </div>
          )}

          {paymentMode === "eftpos" && (
            <div className="space-y-3 text-center">
              {totalReceived > 0 && (
                <p className="text-sm text-gray-500">
                  Remaining to charge: ₹{remainingAmount}
                </p>
              )}

              <p>Please process payment on EFTPOS machine.</p>

              <Button onClick={() => completeOrder("eftpos")}>
                Confirm EFTPOS Payment
              </Button>
            </div>
          )}

          {paymentMode === "unpaid" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-sm text-gray-500">Order Total</div>
                <div className="text-xl font-bold">₹{cartTotal}</div>

                <div className="text-sm text-gray-500 mt-3">
                  Partial Cash Received
                </div>
                <div className="text-2xl font-bold text-green-600">
                  ₹{totalReceived}
                </div>

                <div className="text-sm text-gray-600 mt-2">
                  Remaining Due: ₹{Math.max(0, cartTotal - totalReceived)}
                </div>
              </div>

              <div className="max-h-[45vh] overflow-y-auto">
                <DenominationSelector
                  breakdown={cashBreakdown}
                  setBreakdown={setCashBreakdown}
                  title="Cash Received"
                />
              </div>

              <Button
                className="w-full"
                disabled={
                  totalReceived < 0 || totalReceived >= cartTotal // 🔥 prevents full payment
                }
                onClick={() => completeOrder("unpaid")}
              >
                Save Credit Order
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Print Bill?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Do you want to print bill #{printBillNumber}?
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPrintDialogOpen(false)}
              >
                Skip
              </Button>

              <Button
                className="flex-1 bg-primary text-white"
                onClick={() => {
                  window.open(`/print/${printBillNumber}`, "_blank");
                  setPrintDialogOpen(false);
                }}
              >
                Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={menuAdminOpen} onOpenChange={setMenuAdminOpen}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Menu Management</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 overflow-y-auto">
            <div className="space-y-6">
              {/* CATEGORY LIST */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Categories</h3>

                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingCategory(null);
                      setFormName("");
                      setFormColor("#6366f1");
                      setCategoryDialogOpen(true);
                    }}
                  >
                    Add Category
                  </Button>
                </div>

                <div className="space-y-2">
                  {categories?.map((cat: any) => (
                    <div
                      key={cat.id}
                      className="flex justify-between items-center border p-2 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ background: cat.color }}
                        />
                        {cat.name}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingCategory(cat);
                            setFormName(cat.name);
                            setFormColor(cat.color);
                            setCategoryDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteCategory(cat.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MENU ITEMS */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Menu Items</h3>

                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingMenuItem(null);
                      setFormName("");
                      setFormPrice(0);
                      setFormCategory(null);
                      setIsWeightBased(false);
                      setMenuItemDialogOpen(true);
                    }}
                  >
                    Add Item
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-auto">
                  {menuItems?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center border p-2 rounded"
                    >
                      <div>
                        {item.name}
                        <div className="text-xs text-gray-500">
                          ₹{item.price}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingMenuItem(item);
                            setFormName(item.name);
                            setFormPrice(item.price);
                            setFormCategory(item.category_id);
                            setIsWeightBased(item.is_weight_based || false); 
                            setMenuItemDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMenuItem(item.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Add Category"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Category Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />

            <Input
              type="color"
              value={formColor}
              onChange={(e) => setFormColor(e.target.value)}
            />

            <Button
              className="w-full"
              onClick={() => {
                if (editingCategory) {
                  updateCategory({
                    id: editingCategory.id,
                    name: formName,
                    color: formColor,
                    sort_order: editingCategory.sort_order || 0,
                    is_active: true,
                  });
                } else {
                  createCategory({
                    name: formName,
                    color: formColor,
                    sort_order: 0,
                  });
                }

                setCategoryDialogOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={menuItemDialogOpen} onOpenChange={setMenuItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMenuItem ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Item Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />

            <Input
              type="number"
              placeholder="Price"
              value={formPrice}
              onChange={(e) => setFormPrice(Number(e.target.value))}
            />

            <select
              className="border rounded p-2 w-full"
              value={formCategory || ""}
              onChange={(e) => setFormCategory(Number(e.target.value))}
            >
              <option value="">Select Category</option>

              {categories?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={isWeightBased}
    onChange={(e) => setIsWeightBased(e.target.checked)}
  />
  <label className="text-sm text-gray-700">
    Weight-based item (kg / decimal)
  </label>
</div>


            <Button
              className="w-full"
              onClick={() => {
                if (editingMenuItem) {
                  updateMenuItem({
                    id: editingMenuItem.id,
                    name: formName,
                    price: formPrice,
                    category_id: formCategory,
                    is_active: true,
                    is_weight_based: isWeightBased,
                  });
                } else {
                  createMenuItem({
                    name: formName,
                    price: formPrice,
                    category_id: formCategory,
                    is_weight_based: isWeightBased,
                  });
                }

                setMenuItemDialogOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
