
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
import { Input } from "@/components/ui/input";
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
  Landmark,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/use-orders";
import { Link } from "wouter";
import { useCurrentCash,useRecountCash } from "@/hooks/use-cash";
import { useWithdrawCash,useWithdrawalHistory,useDepositCash,useDepositHistory } from "@/hooks/use-withdraw";
import { DenominationSelector } from "@/components/DenominationSelector";
import { useSettings } from "@/hooks/use-settings";
import { usePartners } from "@/hooks/use-partners";
import { useLocation } from "wouter";
import { useBankBalance,useBankTransaction } from "@/hooks/use-bank";

export default function Dashboard() {
  const { user } = useAuthStore();
const isAdmin = user?.role === "ADMIN";

const { data: settings } = useSettings();
const [, navigate] = useLocation();

const useBusinessDay = settings?.use_business_day ?? false;

const enableCashRecount = settings?.enable_cash_recount ?? true;

const { data: currentDay, isLoading } = useCurrentBusinessDay(useBusinessDay);

const { data: balance } = useBankBalance();
const { mutate: bankTx } = useBankTransaction();

const { data: partners } = usePartners()
const [withdrawPartnerId,setWithdrawPartnerId] = useState<number | null>(null)
const [depositPartnerId,setDepositPartnerId] = useState<number | null>(null)

  const { mutate: openDay, isPending: isOpening } = useOpenBusinessDay();
  const { mutate: closeDay, isPending: isClosing } = useCloseBusinessDay();
  const { data: orders } = useOrders();
  const { toast } = useToast();
  const businessDayId = useBusinessDay ? currentDay?.id : null;
  const { data: drawerCash } = useCurrentCash(businessDayId);
  const { mutate: recountCash } = useRecountCash()
  const { data: expectedData } = useExpectedCash(useBusinessDay);

  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawDescription, setWithdrawDescription] = useState("");
  const [closingReason, setClosingReason] = useState("");
  const [withdrawHistoryOpen, setWithdrawHistoryOpen] = useState(false);
const [depositHistoryOpen, setDepositHistoryOpen] = useState(false);

const { data: withdrawHistory } = useWithdrawalHistory(businessDayId);
const { data: depositHistory } = useDepositHistory(businessDayId);

  

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

const [recountOpen, setRecountOpen] = useState(false)

const [recountBreakdown, setRecountBreakdown] = useState(
  DENOMS.map(d => ({ note: d, qty: 0 }))
)

const recountTotal = recountBreakdown.reduce(
  (sum, n) => sum + n.note * n.qty,
  0
)

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

const [bankDepositOpen, setBankDepositOpen] = useState(false);
const [bankWithdrawOpen, setBankWithdrawOpen] = useState(false);
const [cashToBankOpen, setCashToBankOpen] = useState(false);
const [bankToCashOpen, setBankToCashOpen] = useState(false);

const [bankAmount, setBankAmount] = useState("");
const [bankDesc, setBankDesc] = useState("");

const handleRecount = () => {

  const hasCash = recountBreakdown.some(n => n.qty > 0)

  if (!hasCash) {
    toast({
      title: "Invalid Count",
      description: "Please enter at least one denomination.",
      variant: "destructive"
    })
    return
  }

  recountCash(
    { breakdown: recountBreakdown },
    {
      onSuccess: () => {
        setRecountOpen(false)
        setRecountBreakdown(DENOMS.map(d => ({ note: d, qty: 0 })))
      }
    }
  )
}

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
      businessDayId: businessDayId,
     partnerId: withdrawPartnerId ?? null,
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
  setWithdrawPartnerId(null)
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


const showDashboard = !useBusinessDay || currentDay;

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
Business Day: {useBusinessDay ? currentDay?.date : new Date().toLocaleDateString()}
</p>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                useBusinessDay
  ? currentDay
    ? "bg-green-100 text-green-700 border border-green-200"
    : "bg-amber-100 text-amber-700 border border-amber-200"
  : "bg-blue-100 text-blue-700 border border-blue-200"
              }`}
            >
              {currentDay ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {useBusinessDay
  ? currentDay
    ? "Business Open"
    : "Business Closed"
  : "Using Real Date"}
            </div>



            

            
          </div>
        </div>

        {/* CONTENT */}
        {showDashboard ? (
          <>
    {isAdmin && (
          <>
          
            {/* STATS */}
{isAdmin && (
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

              <StatCard
  title="Bank Balance"
  value={`₹${Number(balance?.balance || 0).toLocaleString()}`}
  icon={Landmark}
  className={
    Number(balance?.balance || 0) >= 0
      ? "border-green-200 bg-green-50"
      : "border-red-200 bg-red-50"
  }
/>

                        </div>
          )}
</>)}
          
{/* ACTION CARDS */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">

  {isAdmin && ( <div 
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
  )}

  {isAdmin && (<div
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
  )}

  {isAdmin && (<div
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
  )}

 {useBusinessDay && currentDay ? (
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
) : null}

{enableCashRecount ? (
  <div
    onClick={() => setRecountOpen(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
        <DollarSign className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Recount Cash</h3>
        <p className="text-sm text-muted-foreground">
          Recalculate drawer cash
        </p>
      </div>
    </div>
  </div>
) : null}
{isAdmin && (<div
  onClick={() => {
  if (settings?.enable_partners) {
    navigate("/withdrawals-history");
  } else {
    setWithdrawHistoryOpen(true);
  }
}}
  className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
>
  <div className="flex items-center gap-4">
    <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
      <DollarSign className="w-7 h-7" />
    </div>
    <div>
      <h3 className="font-semibold text-lg">Withdrawal History</h3>
      <p className="text-sm text-muted-foreground">
        View cash removed today
      </p>
    </div>
  </div>
</div>
)}
{isAdmin && (<div
  onClick={() => {
  if (settings?.enable_partners) {
    navigate("/withdrawals-history");
  } else {
    setDepositHistoryOpen(true);
  }
}}
  className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
>
  <div className="flex items-center gap-4">
    <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
      <TrendingUp className="w-7 h-7" />
    </div>
    <div>
      <h3 className="font-semibold text-lg">Deposit History</h3>
      <p className="text-sm text-muted-foreground">
        View cash added today
      </p>
    </div>
  </div>
</div>
)}


{isAdmin && (
  <div
    onClick={() => setBankDepositOpen(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-green-100 text-green-700 rounded-full flex items-center justify-center">
        <Landmark className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Bank Deposit</h3>
        <p className="text-sm text-muted-foreground">
          Add money to bank account
        </p>
      </div>
    </div>
  </div>
)}

{isAdmin && (
  <div
    onClick={() => setBankWithdrawOpen(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
        <Landmark className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Bank Withdraw</h3>
        <p className="text-sm text-muted-foreground">
          Withdraw money from bank
        </p>
      </div>
    </div>
  </div>
)}

{isAdmin && (
  <div
    onClick={() => setCashToBankOpen(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
        <Landmark className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Cash → Bank</h3>
        <p className="text-sm text-muted-foreground">
          Move cash to bank account
        </p>
      </div>
    </div>
  </div>
)}

{isAdmin && (
  <div
    onClick={() => setBankToCashOpen(true)}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg transition border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
        <Landmark className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Bank → Cash</h3>
        <p className="text-sm text-muted-foreground">
          Withdraw cash from bank
        </p>
      </div>
    </div>
  </div>
)}

{isAdmin && (
  <div
    onClick={() => navigate("/bank-history")}
    className="cursor-pointer bg-white rounded-xl p-6 shadow hover:shadow-lg border"
  >
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
        <Landmark className="w-7 h-7" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Bank History</h3>
        <p className="text-sm text-muted-foreground">
          View all transactions
        </p>
      </div>
    </div>
  </div>
)}
</div>


            {/* ACTIONS */}
            <div className="mt-10"></div>
            {isAdmin && (<Link href="/unpaid">
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
  )}

            
          </>
           ) : (
  <div className="bg-white rounded-xl p-12 text-center border shadow-sm">
    <h3 className="text-lg font-semibold text-gray-900">
      Business Closed
    </h3>
    <p className="text-gray-500 mt-2 mb-6">
      Start a new business day to begin taking orders.
    </p>

    <Button
      className="bg-primary text-white"
      onClick={() => setOpenDialogOpen(true)}
    >
      Open Business Day
    </Button>
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

  {settings?.enable_partners && (
<div className="mt-4">

<label className="block text-sm font-medium mb-2">
Select Partner
</label>

<select
className="w-full border rounded-md p-2"
value={withdrawPartnerId ?? ""}
onChange={(e)=>setWithdrawPartnerId(Number(e.target.value))}
>

<option value="">Select Partner</option>

{partners?.map((p:any)=>(
<option key={p.id} value={p.id}>
{p.name}
</option>
))}

</select>

</div>
)}

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
    {settings?.enable_partners && (
<div className="mt-4">

<label className="block text-sm font-medium mb-2">
Select Partner
</label>

<select
className="w-full border rounded-md p-2"
value={depositPartnerId ?? ""}
onChange={(e)=>setDepositPartnerId(Number(e.target.value))}
>

<option value="">Select Partner</option>

{partners?.map((p:any)=>(
<option key={p.id} value={p.id}>
{p.name}
</option>
))}

</select>

</div>
)}
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
        businessDayId: businessDayId,
        partnerId: depositPartnerId ?? null,
        breakdown: depositBreakdown,
        reason: "Drawer Refill",
      },
      {
        onSuccess: () => {
          setDepositOpen(false);
          setDepositBreakdown(
            DENOMS.map(d => ({ note: d, qty: 0 }))
          );
  setDepositPartnerId(null)

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
<Dialog open={withdrawHistoryOpen} onOpenChange={setWithdrawHistoryOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Withdrawal History</DialogTitle>
    </DialogHeader>

    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {withdrawHistory?.length === 0 && (
        <p className="text-muted-foreground">No withdrawals today.</p>
      )}

      {withdrawHistory?.map((w: any) => (
        <div
          key={w.id}
          className="border rounded-lg p-4 flex justify-between"
        >
          <div>
            <p className="font-medium">₹{w.amount}</p>
            <p className="text-xs text-muted-foreground">
              {w.reason}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(w.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  </DialogContent>
</Dialog>

<Dialog open={depositHistoryOpen} onOpenChange={setDepositHistoryOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Deposit History</DialogTitle>
    </DialogHeader>

    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {depositHistory?.length === 0 && (
        <p className="text-muted-foreground">No deposits today.</p>
      )}

      {depositHistory?.map((d: any) => (
        <div
          key={d.id}
          className="border rounded-lg p-4 flex justify-between"
        >
          <div>
            <p className="font-medium">₹{d.amount}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(d.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
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

<Dialog open={recountOpen} onOpenChange={setRecountOpen}>
  <DialogContent className="max-w-3xl">

    <DialogHeader>
      <DialogTitle>Recount Drawer Cash</DialogTitle>
      <DialogDescription>
        Enter actual denominations currently inside drawer.
      </DialogDescription>
    </DialogHeader>

    <DenominationSelector
      breakdown={recountBreakdown}
      setBreakdown={setRecountBreakdown}
    />

    <div className="text-xl font-bold text-center mt-6">
      Total Cash: ₹{recountTotal}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setRecountOpen(false)}>
        Cancel
      </Button>

      <Button
        className="bg-indigo-600 text-white"
        onClick={handleRecount}
      >
        Update Drawer
      </Button>
    </DialogFooter>

  </DialogContent>
</Dialog>

<Dialog open={bankDepositOpen} onOpenChange={setBankDepositOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Bank Deposit</DialogTitle>
      <DialogDescription>Add money to bank account</DialogDescription>
    </DialogHeader>

    <Input
      placeholder="Amount"
      type="number"
      value={bankAmount}
      onChange={(e) => setBankAmount(e.target.value)}
    />

    <textarea
      className="w-full border rounded-md p-2 mt-3"
      placeholder="Description (optional)"
      value={bankDesc}
      onChange={(e) => setBankDesc(e.target.value)}
    />

    <DialogFooter>
      <Button variant="outline" onClick={() => setBankDepositOpen(false)}>
        Cancel
      </Button>

      <Button
        className="bg-green-600 text-white"
        onClick={() => {
          if (!bankAmount) return;

          bankTx({
            amount: Number(bankAmount),
            type: "credit",
            source: "owner_deposit",
            description: bankDesc
          });

          setBankDepositOpen(false);
          setBankAmount("");
          setBankDesc("");
        }}
      >
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog open={bankWithdrawOpen} onOpenChange={setBankWithdrawOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Bank Withdraw</DialogTitle>
      <DialogDescription>Withdraw money from bank</DialogDescription>
    </DialogHeader>

    <Input
      placeholder="Amount"
      type="number"
      value={bankAmount}
      onChange={(e) => setBankAmount(e.target.value)}
    />

    <textarea
      className="w-full border rounded-md p-2 mt-3"
      placeholder="Reason"
      value={bankDesc}
      onChange={(e) => setBankDesc(e.target.value)}
    />

    <DialogFooter>
      <Button variant="outline" onClick={() => setBankWithdrawOpen(false)}>
        Cancel
      </Button>

      <Button
        className="bg-red-600 text-white"
        onClick={() => {
          if (!bankAmount) return;

          bankTx({
            amount: Number(bankAmount),
            type: "debit",
            source: "owner_withdraw",
            description: bankDesc
          });

          setBankWithdrawOpen(false);
          setBankAmount("");
          setBankDesc("");
        }}
      >
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog open={cashToBankOpen} onOpenChange={setCashToBankOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Cash → Bank</DialogTitle>
      <DialogDescription>Move cash to bank</DialogDescription>
    </DialogHeader>

    <DenominationSelector
      breakdown={withdrawBreakdown}
      setBreakdown={setWithdrawBreakdown}
    />

    <div className="text-center font-bold mt-4">
      Total: ₹{withdrawTotal}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setCashToBankOpen(false)}>
        Cancel
      </Button>

      <Button
        className="bg-blue-600 text-white"
        onClick={() => {
          if (!withdrawTotal) return;

          const denominationsObj: any = {};
          withdrawBreakdown.forEach(d => {
            if (d.qty > 0) denominationsObj[d.note] = d.qty;
          });

          bankTx({
            amount: withdrawTotal,
            type: "credit",
            source: "cash_transfer",
            denominations: denominationsObj
          });

          setCashToBankOpen(false);
          setWithdrawBreakdown(DENOMS.map(d => ({ note: d, qty: 0 })));
        }}
      >
        Transfer
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog open={bankToCashOpen} onOpenChange={setBankToCashOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Bank → Cash</DialogTitle>
      <DialogDescription>Withdraw cash from bank</DialogDescription>
    </DialogHeader>

    <DenominationSelector
      breakdown={depositBreakdown}
      setBreakdown={setDepositBreakdown}
    />

    <div className="text-center font-bold mt-4">
      Total: ₹{depositTotal}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setBankToCashOpen(false)}>
        Cancel
      </Button>

      <Button
        className="bg-indigo-600 text-white"
        onClick={() => {
          if (!depositTotal) return;

          const denominationsObj: any = {};
          depositBreakdown.forEach(d => {
            if (d.qty > 0) denominationsObj[d.note] = d.qty;
          });

          bankTx({
            amount: depositTotal,
            type: "debit",
            source: "bank_to_cash",
            denominations: denominationsObj
          });

          setBankToCashOpen(false);
          setDepositBreakdown(DENOMS.map(d => ({ note: d, qty: 0 })));
        }}
      >
        Withdraw Cash
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

    </div>

    
  );
}