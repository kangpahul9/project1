import {
  useCurrentBusinessDay,
  useOpenBusinessDay,
  useCloseBusinessDay,
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
import { useWithdrawCash } from "@/hooks/use-withdraw";
import { DenominationSelector } from "@/components/DenominationSelector";



export default function Dashboard() {
  const { data: currentDay, isLoading } = useCurrentBusinessDay();
  const { mutate: openDay, isPending: isOpening } = useOpenBusinessDay();
  const { mutate: closeDay, isPending: isClosing } = useCloseBusinessDay();
  const { data: orders } = useOrders(currentDay?.id);
  const { toast } = useToast();
  const { data: drawerCash } = useCurrentCash(currentDay?.id);

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [cashDialog, setCashDialog] = useState(false);


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
  closeDay(
    {
      breakdown: closingBreakdown,
      total: closingTotal,
    },
    {
      onSuccess: () => {
        setCloseDialogOpen(false);
        setClosingBreakdown(DENOMS.map(d => ({ note: d, qty: 0 })));
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

  withdrawCash(
    {
      businessDayId: currentDay?.id,
      breakdown: withdrawBreakdown,
    },
    {
      onSuccess: () => {
        setWithdrawOpen(false);
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

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of today's performance
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

{currentDay ? (
  <>
    <Button
      variant="outline"
      onClick={() => setCashDialog(true)}
    >
      Check Drawer Cash
    </Button>

    <Button
      className="bg-red-600 hover:bg-red-700 text-white"
      onClick={() => setCloseDialogOpen(true)}
    >
      Close Day
    </Button>

    <Button
      className="bg-amber-600 hover:bg-amber-700 text-white"
      onClick={() => setWithdrawOpen(true)}
    >
      Withdraw Cash
    </Button>
  </>
) : (
  <Button
    className="bg-primary text-white"
    onClick={() => setOpenDialogOpen(true)}
  >
    Open Day
  </Button>
)}



            

            
          </div>
        </div>

        {/* CONTENT */}
        {currentDay ? (
          <>
            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Sales"
                value={`₹${totalSales}`}
                icon={DollarSign}
              />
              <StatCard
                title="Total Orders"
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

            {/* ACTIONS */}
            <Link href="/unpaid">
              <Button className="bg-amber-500 hover:bg-amber-600 text-white">
                View Unpaid Orders
              </Button>
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
