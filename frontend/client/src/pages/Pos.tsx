import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useMenu } from "@/hooks/use-menu";
import { useCreateOrder } from "@/hooks/use-orders";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { useAuthStore } from "@/hooks/use-auth";
import { MenuItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2, Wifi, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useMarkOrderPaid, useUnpaidOrders } from "@/hooks/use-unpaid-orders";
import { useOrderById } from "@/hooks/use-unpaid-orders";
import { useEffect } from "react";
import { DenominationSelector } from "@/components/DenominationSelector";




interface CartItem extends MenuItem {
  quantity: number;
}

export default function Pos() {
  const [location, navigate] = useLocation();

// 🔥 Use real browser search params
const searchParams = new URLSearchParams(window.location.search);
const unpaidOrderId = searchParams.get("pay");
const isUnpaidPayment = !!unpaidOrderId;

const { data: unpaidOrder, isLoading: unpaidLoading } = useOrderById(unpaidOrderId);



  const { data: menuItems, isLoading } = useMenu();
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

const [paymentMode, setPaymentMode] =
  useState<"cash" | "upi" | "eftpos" | "unpaid" | null>(null);  const [customerName, setCustomerName] = useState("");
const DENOMS = [500,200,100,50,20,10,5,2,1];
const NOTE_COLORS: Record<number, string> = {
  500: "bg-amber-400",
  200: "bg-orange-400",
  100: "bg-purple-400",
  50:  "bg-blue-400",
  20:  "bg-green-400",
  10:  "bg-yellow-400",
  5:   "bg-gray-300",
  2:   "bg-gray-400",
  1:   "bg-gray-500",
};

const [discount, setDiscount] = useState(0);

const [customerPhone, setCustomerPhone] = useState("");
const [partialAmount, setPartialAmount] = useState(0);



const [cashBreakdown, setCashBreakdown] = useState(
  DENOMS.map(d => ({ note: d, qty: 0 }))
);

const [pendingChange, setPendingChange] = useState<any[]>([]);
const [awaitingChangeConfirm, setAwaitingChangeConfirm] = useState(false);

const [printDialogOpen, setPrintDialogOpen] = useState(false);
const [printBillNumber, setPrintBillNumber] = useState<string | null>(null);


  const subtotal = cart.reduce(
  (acc, item) => acc + item.price * item.quantity,
  0
);

// Prefill cart when settling unpaid
useEffect(() => {
  if (isUnpaidPayment && unpaidOrder?.items) {
    setCart(
      unpaidOrder.items.map((item: any) => ({
        id: item.menu_item_id,
        name: item.item_name,
        price: Number(item.price_snapshot),
        quantity: item.quantity,
      }))
    );

    setCustomerName(unpaidOrder.customer_name || "");
    setCustomerPhone(unpaidOrder.customer_phone || "");
  }
}, [unpaidOrder, isUnpaidPayment]);


// Auto-fill returning customer from localStorage
useEffect(() => {
  if (customerPhone.length >= 8) {
    const lastCustomer = JSON.parse(
      localStorage.getItem("lastCustomer") || "null"
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
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };
const adjustNote = (note:number, delta:number) => {
  setCashBreakdown(prev =>
    prev.map(n =>
      n.note === note
        ? { ...n, qty: Math.max(0, n.qty + delta) }
        : n
    )
  );
};

const totalReceived = cashBreakdown.reduce(
  (sum, n) => sum + n.note * n.qty,
  0
);

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev =>
      prev
        .map(item =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  /* ===============================
     GENERATE REAL UPI LINK
  =============================== */
  const generateUpiLink = () => {
    const upiId = "yourbusiness@upi"; // change later
    const name = "My Restaurant";
    const amount = cartTotal.toFixed(2);
    const note = "POS Payment";

    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
      name
    )}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  };

  /* ===============================
     COMPLETE ORDER
  =============================== */
 const completeOrder = (
  method: "cash" | "upi" | "eftpos" | "unpaid"
) => {
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
  method === "upi"
    ? "online"
    : method === "eftpos"
    ? "card"
    : method,
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
      }
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
  method === "upi"
    ? "online"
    : method === "eftpos"
    ? "card"
    : method,      cashBreakdown:
  method === "cash" || (method === "unpaid" && totalReceived > 0)
    ? cashBreakdown
    : null,
      discount,
amountPaid:
  method === "unpaid"
    ? totalReceived
    : undefined,
      items: cart.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
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
    }
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
    })
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
  setCashBreakdown(DENOMS.map(d => ({ note: d, qty: 0 })));

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
<div className="flex flex-col lg:flex-row bg-gray-50 min-h-screen">
      <Sidebar />

<main className="flex-1 lg:ml-64 p-4 sm:p-6">
        <div className="mb-4">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <ScrollArea className="h-[70vh]">
<div className="grid 
  grid-cols-2 
  sm:grid-cols-3 
  md:grid-cols-4 
  lg:grid-cols-5 
  gap-4"
>
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
                menuItems
  ?.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  .sort((a, b) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  )
  .map(item => (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="bg-white p-4 rounded shadow cursor-pointer"
                  >
                    <h3>{item.name}</h3>
                    <p>₹{item.price}</p>
                  </div>
                ))
            )}
          </div>
        </ScrollArea>
      </main>

      

      {/* CART */}
<aside className="w-full lg:w-[400px] bg-white border-t lg:border-l flex flex-col">
        {isUnpaidPayment && unpaidOrder && (
  <div className="bg-amber-100 border border-amber-300 p-3 text-amber-800 text-sm">
    Settling Unpaid Order #{unpaidOrder.id}
  </div>
)}
        <div className="p-4 border-b">
          <h2 className="font-bold flex items-center gap-2">
            <ShoppingCart size={18} />
            Cart
          </h2>
          
        </div>

        <ScrollArea className="flex-1 p-4">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between mb-3">
              <div>
                <p>{item.name}</p>
                <p className="text-sm text-gray-500">
                  ₹{item.price} x {item.quantity}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => updateQuantity(item.id, -1)}>
                  <Minus size={16} />
                </button>
                <button onClick={() => updateQuantity(item.id, 1)}>
                  <Plus size={16} />
                </button>
                <button onClick={() => removeFromCart(item.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </ScrollArea>

        <div className="flex justify-between items-center mt-2">
  <span className="text-sm text-gray-600">Discount</span>
  <Input
  type="number"
  min={0}
  value={discount}
  disabled={isUnpaidPayment}
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
    className="w-full mt-4"
    disabled={cart.length === 0}
    onClick={() => setCheckoutOpen(true)}
  >
    Checkout
  </Button>

</div>

      </aside>

{/* PAYMENT METHOD SELECT */}
<Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
<DialogContent className="w-[95vw] max-w-4xl">
    <DialogHeader>
      <DialogTitle>Select Payment Method</DialogTitle>
    </DialogHeader>

    <div className="grid grid-cols-2 gap-4 mt-4">

      <Button onClick={() => handleCheckout("cash")}>
        <Banknote className="mr-2" /> Cash
      </Button>

      <Button onClick={() => handleCheckout("upi")}>
        <Wifi className="mr-2" /> UPI
      </Button>

      <Button onClick={() => handleCheckout("eftpos")}>
        Card
      </Button>

      {!isUnpaidPayment && (<Button
        className="bg-amber-500 hover:bg-amber-600 text-white"
        onClick={() => handleCheckout("unpaid")}
      >
        Credit
      </Button>)}

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

          {paymentMode === "cash" && (

  awaitingChangeConfirm ? (

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


      <DenominationSelector
  breakdown={cashBreakdown}
  setBreakdown={setCashBreakdown}
  title="Cash Received"
/>

      <Button
        className="w-full mt-4"
          disabled={totalReceived === 0}
        onClick={() => completeOrder("cash")}
      >
        Confirm Payment
      </Button>

    </div>

  )
)}


          {paymentMode === "upi" && (
            <div className="space-y-3 text-center">
              <a
                href={generateUpiLink()}
                className="bg-black text-white px-4 py-2 rounded"
              >
                Open UPI App
              </a>

              <div className="w-48 h-48 bg-gray-200 mx-auto flex items-center justify-center rounded">
                QR Placeholder
              </div>

<Button onClick={() => completeOrder("upi")}>
                Confirm Payment
              </Button>
            </div>
          )}

          {paymentMode === "eftpos" && (
            <div className="space-y-3 text-center">
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

      <div className="text-sm text-gray-500 mt-3">Partial Cash Received</div>
      <div className="text-2xl font-bold text-green-600">
        ₹{totalReceived}
      </div>

      <div className="text-sm text-gray-600 mt-2">
        Remaining Due: ₹{Math.max(0, cartTotal - totalReceived)}
      </div>
    </div>

    <DenominationSelector
  breakdown={cashBreakdown}
  setBreakdown={setCashBreakdown}
  title="Cash Received"
/>

    <Button
      className="w-full"
      disabled={
        totalReceived < 0 ||
        totalReceived >= cartTotal   // 🔥 prevents full payment
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

    </div>
  );
}
