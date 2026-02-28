
import {
  useCurrentBusinessDay,
  useOpenBusinessDay,
  useCloseBusinessDay,
  useExpectedCash,
} from "@/hooks/use-business-days";
import { useAuthStore } from "@/hooks/use-auth";
import { StatCard } from "@/components/StatCard";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DollarSign,
  ShoppingBag,
  CreditCard,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/use-orders";
import { Link } from "wouter";
import { useCurrentCash } from "@/hooks/use-cash";
import { useWithdrawCash,useWithdrawalHistory,useDepositCash,useDepositHistory } from "@/hooks/use-withdraw";
import { DenominationSelector } from "@/components/DenominationSelector";



export default function Dashboard() {
  const { data: currentDay, isLoading } = useCurrentBusinessDay();
  const { mutate: openDay, isPending: isOpening } = useOpenBusinessDay();
  const { mutate: closeDay, isPending: isClosing } = useCloseBusinessDay();
  const { data: orders } = useOrders();
  const { toast } = useToast();
  const { data: drawerCash } = useCurrentCash(currentDay?.id);
  const { data: expectedData } = useExpectedCash();

  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawDescription, setWithdrawDescription] = useState("");
  const [closingReason, setClosingReason] = useState("");
  

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [cashDialog, setCashDialog] = useState(false);
const { mutate: depositCash } = useDepositCash();

 const [denominations, setDenominations] = useState([
  { note: 500, qty: 0 },
  { note: 200, qty: 0 },
  { note: 100, qty: 0 },
  { note: 50, qty: 0 },
  { note: 20, qty: 0 },
  { note: 10, qty: 0 },
  { note: 5, qty: 0 },
  { note: 2, qty: 0 },
  { note: 1, qty: 0 },
]);



  const onOpenDay = () => {
    const hasCash = denominations.some((d) => d.qty > 0);

    if (!hasCash) {
      toast({
        title: "Invalid Opening",
        description: "Please enter at least one denomination.",
        variant: "destructive",
      });
      return;
    }

    openDay(denominations, {
      onSuccess: () => setOpenDialogOpen(false),
    });
  };

  const onCloseDay = () => {

  if (hasMismatch && !closingReason.trim()) {
    toast({
      title: "Reason Required",
      description: "Please explain the cash mismatch before closing.",
      variant: "destructive",
    });
    return;
  }

  closeDay(
    {
      breakdown: closingBreakdown,
      total: closingTotal,
      reason: hasMismatch ? closingReason : null,
    },
    {
      onSuccess: () => {
        setCloseDialogOpen(false);
        setClosingBreakdown(DENOMS.map(d => ({ note: d, qty: 0 })));
        setClosingReason("");
      },
    }
  );
};

  /* ================= SALES CALCULATIONS ================= */

  const totalOrders = orders?.length || 0;

  const totalSales =
    orders?.reduce((acc: number, order: any) => acc + Number(order.total), 0) ||
    0;

  const onlineSales =
    orders
      ?.filter(
        (o: any) =>
          o.payment_method === "online" || o.payment_method === "card"
      )
      .reduce((acc: number, o: any) => acc + Number(o.total), 0) || 0;


/* ================= WITHDRAW STATE ================= */

const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

const openingTotal = denominations.reduce(
  (sum, n) => sum + n.note * n.qty,
  0
);

const [closingBreakdown, setClosingBreakdown] = useState(
  DENOMS.map(d => ({ note: d, qty: 0 }))
);

const closingTotal = closingBreakdown.reduce(
  (sum, n) => sum + n.note * n.qty,
  0
);

const { mutate: withdrawCash } = useWithdrawCash();
const [withdrawOpen, setWithdrawOpen] = useState(false);

const [withdrawBreakdown, setWithdrawBreakdown] = useState(
  DENOMS.map(d => ({ note: d, qty: 0 }))
);

const withdrawTotal = withdrawBreakdown.reduce(
  (sum, n) => sum + n.note * n.qty,
  0
);

const [depositOpen, setDepositOpen] = useState(false);

const [depositBreakdown, setDepositBreakdown] = useState(
  DENOMS.map(d => ({ note: d, qty: 0 }))
);

const depositTotal = depositBreakdown.reduce(
  (sum, n) => sum + n.note * n.qty,
  0
);



const handleWithdraw = () => {
  const hasCash = withdrawBreakdown.some(n => n.qty > 0);

  if (!hasCash) {
    toast({
      title: "Invalid Withdrawal",
      description: "Select at least one denomination.",
      variant: "destructive",
    });
    return;
  }

  if (!withdrawReason) {
  toast({
    title: "Select Reason",
    description: "Please choose withdrawal reason.",
    variant: "destructive",
  });
  return;
}

if (withdrawReason === "Other" && !withdrawDescription.trim()) {
  toast({
    title: "Description Required",
    description: "Please enter description for 'Other'.",
    variant: "destructive",
  });
  return;
}

  withdrawCash(
    {
      businessDayId: currentDay?.id,
      breakdown: withdrawBreakdown,
      reason: withdrawReason,
      description: withdrawDescription,
    },
    {
      onSuccess: () => {
  setWithdrawOpen(false);
  setWithdrawReason("");
  setWithdrawDescription("");
  setWithdrawBreakdown(DENOMS.map(d => ({ note: d, qty: 0 })));
},
    }
  );
};


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const expectedCash = expectedData?.expectedCash ?? 0;
const difference = closingTotal - expectedCash;
const hasMismatch = Math.abs(difference) > 0.01;

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
  Business Day: {currentDay?.date}
</p>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                currentDay
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-amber-100 text-amber-700 border border-amber-200"
              }`}
            >
              {currentDay ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {currentDay ? "Business Open" : "Business Closed"}
            </div>



            

            
          </div>
        </div>

        {/* CONTENT */}
        {currentDay ? (
          <>
            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Today's Sales"
                value={`₹${totalSales}`}
                icon={DollarSign}
              />
              <StatCard
                title="Today's Orders"
                value={totalOrders}
                icon={ShoppingBag}
              />
              <StatCard
                title="Online Payments"
                value={`₹${onlineSales}`}
                icon={CreditCard}
              />
              <StatCard
                title="Avg Order Value"
                value={`₹${
                  totalOrders > 0
                    ? Math.round(totalSales / totalOrders)
                    : 0
                }`}
                icon={TrendingUp}
              />
            </div>

          
{/* ACTION CARDS */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">

  <div
    onClick={() => setWithdrawOpen(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
        <DollarSign className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Withdraw Cash</h3>
        <p className="text-sm text-muted-foreground">
          Remove cash from drawer
        </p>
      </div>
    </div>
  </div>

  <div
    onClick={() => setDepositOpen(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
        <TrendingUp className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Add Cash</h3>
        <p className="text-sm text-muted-foreground">
          Deposit into drawer
        </p>
      </div>
    </div>
  </div>

  <div
    onClick={() => setCashDialog(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
        <CreditCard className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Drawer Cash</h3>
        <p className="text-sm text-muted-foreground">
          View real-time balance
        </p>
      </div>
    </div>
  </div>

  <div
    onClick={() => setCloseDialogOpen(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
        <AlertCircle className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Close Day</h3>
        <p className="text-sm text-muted-foreground">
          Finalize business day
        </p>
      </div>
    </div>
  </div>

</div>


            {/* ACTIONS */}
            <div className="mt-10"></div>
            <Link href="/unpaid">
  <div className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
        <ShoppingBag className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Unpaid Orders</h3>
        <p className="text-sm text-muted-foreground">
          View pending customer payments
        </p>
      </div>
    </div>
  </div>
</Link>

            
          </>
        ) : (
          <div className="bg-white rounded-xl p-12 text-center border shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">
              Business Closed
            </h3>
            <p className="text-gray-500 mt-2">
              Start a new business day to begin taking orders.
            </p>
          </div>
        )}
      </main>

      {/* ================= DRAWER CASH DIALOG ================= */}
      <Dialog open={cashDialog} onOpenChange={setCashDialog}>
        <DialogContent>
  <DialogHeader>
    <DialogTitle>Current Drawer Cash</DialogTitle>
    <DialogDescription>
      Real-time cash currently inside drawer.
    </DialogDescription>
  </DialogHeader>

          {drawerCash ? (
            <div className="space-y-3">
              <div className="text-xl font-bold">
                Total: ₹{drawerCash.total}
              </div>

              {drawerCash.breakdown.map((note: any) => (
                <div
                  key={note.note_value}
                  className="flex justify-between"
                >
                  <span>₹{note.note_value}</span>
                  <span>× {note.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <Loader2 className="animate-spin" />
          )}
        </DialogContent>
      </Dialog>
      {/* ================= CLOSE DAY DIALOG ================= */}
<Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Close Business Day</DialogTitle>
      <DialogDescription>
        Count physical cash in drawer before closing.
      </DialogDescription>
    </DialogHeader>

    {/* 💰 DENOMINATION SELECTOR */}
    <DenominationSelector
      breakdown={closingBreakdown}
      setBreakdown={setClosingBreakdown}
    />

    {/* 💵 TOTAL DISPLAY */}
<div className="text-center text-xl font-bold mt-6">
  Closing Cash Count: ₹{closingTotal}
</div>

<div className="text-center text-md mt-2">
  Expected Cash (Ledger): ₹{expectedCash}
</div>

<div
  className={`text-center font-semibold mt-1 ${
    hasMismatch ? "text-red-600" : "text-green-600"
  }`}
>
  Difference: ₹{difference}
</div>

{/* 🔴 SHOW REASON IF MISMATCH */}
{hasMismatch && (
  <div className="mt-4">
    <label className="block text-sm font-medium mb-2 text-red-600">
      Cash Mismatch Reason (Required)
    </label>
    <textarea
      className="w-full border rounded-md p-2"
      rows={3}
      placeholder="Explain why cash mismatch occurred..."
      value={closingReason}
      onChange={(e) => setClosingReason(e.target.value)}
    />
  </div>
)}
    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setCloseDialogOpen(false)}
      >
        Cancel
      </Button>

      <Button
        className="bg-red-600 hover:bg-red-700 text-white"
        onClick={onCloseDay}
        disabled={isClosing}
      >
        {isClosing ? "Closing..." : "Confirm Close"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


{/* ================= WITHDRAW CASH DIALOG ================= */}
<Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
<DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Withdraw Cash</DialogTitle>
      <DialogDescription>
        Select notes to withdraw manually from drawer.
      </DialogDescription>
    </DialogHeader>

    <DenominationSelector
  breakdown={withdrawBreakdown}
  setBreakdown={setWithdrawBreakdown}
/>
<div className="mt-4">
  <label className="block text-sm font-medium mb-2">
    Withdrawal Reason
  </label>

  <select
    className="w-full border rounded-md p-2"
    value={withdrawReason}
    onChange={(e) => setWithdrawReason(e.target.value)}
  >
    <option value="">Select Reason</option>
    <option>Owner Personal</option>
    <option>Supplier Payment</option>
    <option>Bank Deposit</option>
    <option>Petty Cash</option>
    <option>Staff Salary</option>
    <option>Utilities</option>
    <option>Emergency Expense</option>
    <option>Loan Repayment</option>
    <option>Investment Transfer</option>
    <option>Other</option>
  </select>
  <div className="mt-4">
  <label className="block text-sm font-medium mb-2">
    Description {withdrawReason === "Other" && <span className="text-red-500">*</span>}
  </label>

  <textarea
    className="w-full border rounded-md p-2"
    rows={3}
    placeholder="Enter details..."
    value={withdrawDescription}
    onChange={(e) => setWithdrawDescription(e.target.value)}
  />
</div>
</div>
<div className="text-lg font-bold pt-4 text-center">
  Total Withdrawal: ₹{withdrawTotal}
</div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setWithdrawOpen(false)}
      >
        Cancel
      </Button>

      <Button
        className="bg-amber-600 hover:bg-amber-700 text-white"
        onClick={handleWithdraw}
      >
        Confirm Withdrawal
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* ================= DEPOSIT CASH DIALOG ================= */}
<Dialog open={depositOpen} onOpenChange={setDepositOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Add Cash to Drawer</DialogTitle>
      <DialogDescription>
        Add denominations to drawer (mid-day refill).
      </DialogDescription>
    </DialogHeader>

    <DenominationSelector
      breakdown={depositBreakdown}
      setBreakdown={setDepositBreakdown}
    />

    <div className="text-lg font-bold pt-4 text-center">
      Total Deposit: ₹{depositTotal}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setDepositOpen(false)}>
        Cancel
      </Button>

      <Button
  className="bg-green-600 text-white"
  onClick={() => {
    const hasCash = depositBreakdown.some(n => n.qty > 0);

    if (!hasCash) {
      toast({
        title: "Invalid Deposit",
        description: "Select at least one denomination.",
        variant: "destructive",
      });
      return;
    }

    depositCash(
      {
        businessDayId: currentDay?.id,
        breakdown: depositBreakdown,
        reason: "Drawer Refill",
      },
      {
        onSuccess: () => {
          setDepositOpen(false);
          setDepositBreakdown(
            DENOMS.map(d => ({ note: d, qty: 0 }))
          );
        },
      }
    );
  }}
>
  Confirm Deposit
</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* ================= OPEN DAY DIALOG ================= */}
<Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
<DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Open Business Day</DialogTitle>
      <DialogDescription>
        Enter opening cash denominations.
      </DialogDescription>
    </DialogHeader>

   <DenominationSelector
  breakdown={denominations}
  setBreakdown={setDenominations}
/>

<div className="text-center text-xl font-bold mt-6">
  Opening Cash: ₹{openingTotal}
</div>


    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setOpenDialogOpen(false)}
      >
        Cancel
      </Button>

      <Button
        className="bg-primary text-white"
        onClick={onOpenDay}
        disabled={isOpening}
      >
        {isOpening ? "Opening..." : "Confirm Open"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


    </div>

    
  );
}