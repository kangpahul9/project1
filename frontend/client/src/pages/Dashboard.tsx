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
  Trash2,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  RefreshCw,
  XCircle,
  ChevronRight,
  PlayCircle,
  Link2,
  ArrowRightLeft,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { toastError } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/use-orders";
import { Link } from "wouter";
import { useCurrentCash, useRecountCash } from "@/hooks/use-cash";
import {
  useWithdrawCash,
  useWithdrawalHistory,
  useDepositCash,
  useDepositHistory,
  WithdrawalReason,
} from "@/hooks/use-withdraw";
import { DenominationSelector, CashBreakdownDisplay } from "@/components/DenominationSelector";
import { useSettings } from "@/hooks/use-settings";
import { useCurrency, useDenominations } from "@/hooks/use-currency";
import { usePartners } from "@/hooks/use-partners";
import { useLocation } from "wouter";
import { useBankBalance, useBankTransaction } from "@/hooks/use-bank";
import { cn } from "@/lib/utils";

/* ── LOCAL COMPONENTS ── */

function ActionTile({
  icon: Icon,
  iconClass,
  iconBg,
  label,
  desc,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  iconBg: string;
  label: string;
  desc: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border border-transparent hover:border-border bg-muted/40 hover:bg-muted transition-all group"
      )}
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-4 h-4", iconClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", danger ? "text-red-600 dark:text-red-400" : "text-foreground")}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition shrink-0" />
    </button>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

/* ── REUSABLE STYLED INPUTS ── */
const inputCls =
  "w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition";

/* ================================================================ */
export default function Dashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { format } = useCurrency();
  const denoms = useDenominations();
  const [, navigate] = useLocation();

  const useBusinessDay = settings?.use_business_day ?? false;
  const { data: currentDay, isLoading } = useCurrentBusinessDay(useBusinessDay);
  const businessDayId = useBusinessDay && currentDay ? currentDay.id : undefined;
  const enableCashRecount = settings?.enable_cash_recount ?? true;

  const today = new Date().toISOString().split("T")[0];

  const { data: balance } = useBankBalance();
  const { mutate: bankTx } = useBankTransaction();
  const { data: partners } = usePartners();

  const [withdrawPartnerId, setWithdrawPartnerId] = useState<number | null>(null);
  const [depositPartnerId, setDepositPartnerId] = useState<number | null>(null);

  const { mutate: openDay, isPending: isOpening } = useOpenBusinessDay();
  const { mutate: closeDay, isPending: isClosing } = useCloseBusinessDay();
  const { data: orders } = useOrders(useBusinessDay, businessDayId, !useBusinessDay ? today : undefined);

  const { data: drawerCash } = useCurrentCash(useBusinessDay, businessDayId);
  const { mutate: recountCash } = useRecountCash();
  const { data: expectedData } = useExpectedCash(useBusinessDay);

  const [withdrawReason, setWithdrawReason] = useState<WithdrawalReason | "">("");
  const [withdrawDescription, setWithdrawDescription] = useState("");
  const [closingReason, setClosingReason] = useState("");

  const { mutate: depositCash } = useDepositCash();

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [cashDialog, setCashDialog] = useState(false);

  const [denominations, setDenominations] = useState(() => denoms.map((d) => ({ note: d, qty: 0 })));
  const [recountOpen, setRecountOpen] = useState(false);
  const [recountBreakdown, setRecountBreakdown] = useState(denoms.map((d) => ({ note: d, qty: 0 })));
  const recountTotal = recountBreakdown.reduce((sum, n) => sum + n.note * n.qty, 0);

  const openingTotal = denominations.reduce((sum, n) => sum + n.note * n.qty, 0);

  const [closingBreakdown, setClosingBreakdown] = useState(denoms.map((d) => ({ note: d, qty: 0 })));
  const closingTotal = closingBreakdown.reduce((sum, n) => sum + n.note * n.qty, 0);

  const { mutate: withdrawCash } = useWithdrawCash();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawBreakdown, setWithdrawBreakdown] = useState(denoms.map((d) => ({ note: d, qty: 0 })));
  const withdrawTotal = withdrawBreakdown.reduce((sum, n) => sum + n.note * n.qty, 0);

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositBreakdown, setDepositBreakdown] = useState(denoms.map((d) => ({ note: d, qty: 0 })));
  const depositTotal = depositBreakdown.reduce((sum, n) => sum + n.note * n.qty, 0);

  const [bankDepositOpen, setBankDepositOpen] = useState(false);
  const [bankWithdrawOpen, setBankWithdrawOpen] = useState(false);
  const [cashToBankOpen, setCashToBankOpen] = useState(false);
  const [bankToCashOpen, setBankToCashOpen] = useState(false);
  const [bankAmount, setBankAmount] = useState("");
  const [bankDesc, setBankDesc] = useState("");

  /* ── CALCULATIONS ── */
  const totalOrders = orders?.length || 0;
  const totalSales = orders?.reduce((acc: number, o: any) => acc + Number(o.total), 0) || 0;
  const onlineSales =
    orders
      ?.filter((o: any) => o.payment_method === "online" || o.payment_method === "card")
      .reduce((acc: number, o: any) => acc + Number(o.total), 0) || 0;

  const expectedCash = expectedData?.expectedCash ?? 0;
  const difference = closingTotal - expectedCash;
  const hasMismatch = Math.abs(difference) > 0.01;

  /* ── HANDLERS ── */
  const onOpenDay = () => {
    if (!denominations.some((d) => d.qty > 0)) {
      toastError("Please enter at least one denomination.");
      return;
    }
    openDay(denominations, { onSuccess: () => setOpenDialogOpen(false) });
  };

  const onCloseDay = () => {
    if (hasMismatch && !closingReason.trim()) {
      toastError("Please explain the cash mismatch before closing.");
      return;
    }
    closeDay(
      { breakdown: closingBreakdown, total: closingTotal, reason: hasMismatch ? closingReason : null },
      {
        onSuccess: () => {
          setCloseDialogOpen(false);
          setClosingBreakdown(denoms.map((d) => ({ note: d, qty: 0 })));
          setClosingReason("");
        },
      }
    );
  };

  const handleRecount = () => {
    if (!recountBreakdown.some((n) => n.qty > 0)) {
      toastError("Please enter at least one denomination.");
      return;
    }
    recountCash(
      { breakdown: recountBreakdown },
      {
        onSuccess: () => {
          setRecountOpen(false);
          setRecountBreakdown(denoms.map((d) => ({ note: d, qty: 0 })));
        },
      }
    );
  };

  const handleWithdraw = () => {
    if (!withdrawBreakdown.some((n) => n.qty > 0)) { toastError("Select at least one denomination."); return; }
    if (!withdrawReason) { toastError("Please choose withdrawal reason."); return; }
    if (withdrawReason === "Other" && !withdrawDescription.trim()) { toastError("Please enter description for 'Other'."); return; }
    withdrawCash(
      { partnerId: withdrawPartnerId ?? null, breakdown: withdrawBreakdown, reason: withdrawReason as WithdrawalReason, description: withdrawDescription },
      {
        onSuccess: () => {
          setWithdrawOpen(false);
          setWithdrawReason("");
          setWithdrawDescription("");
          setWithdrawBreakdown(denoms.map((d) => ({ note: d, qty: 0 })));
          setWithdrawPartnerId(null);
        },
      }
    );
  };

  /* ── LOADING ── */
  if (settingsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const showDashboard = !useBusinessDay || currentDay;
  const bankBal = Number(balance?.balance || 0);

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-0 lg:ml-60 min-h-screen pt-16 lg:pt-0">
        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8 w-full">

          {/* ── PAGE HEADER ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {useBusinessDay
                  ? currentDay
                    ? `Business day: ${currentDay.date}`
                    : "No business day open"
                  : `Today: ${new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Status badge */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border",
                  useBusinessDay
                    ? currentDay
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                    : "bg-primary/10 text-primary border-primary/20"
                )}
              >
                {currentDay ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {useBusinessDay ? (currentDay ? "Business Open" : "Business Closed") : "Live Mode"}
              </span>

              {/* Open day button (always accessible) */}
              {useBusinessDay && !currentDay && isAdmin && (
                <Button size="sm" onClick={() => setOpenDialogOpen(true)}>
                  <PlayCircle className="w-4 h-4 mr-1.5" />
                  Open Day
                </Button>
              )}
            </div>
          </div>

          {/* ── BUSINESS CLOSED STATE ── */}
          {!showDashboard ? (
            <div className="bg-card rounded-2xl border shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Business Closed</h3>
              <p className="text-muted-foreground mt-2 mb-6 max-w-xs mx-auto text-sm">
                Start a new business day to begin taking orders and tracking sales.
              </p>
              <Button onClick={() => setOpenDialogOpen(true)}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Open Business Day
              </Button>
            </div>
          ) : (
            <>
              {/* ── KPI STATS ── */}
              {isAdmin && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                  <StatCard title="Today's Sales" value={format(totalSales)} icon={DollarSign} />
                  <StatCard title="Orders" value={totalOrders} icon={ShoppingBag} />
                  <StatCard title="Online / Card" value={format(onlineSales)} icon={CreditCard} />
                  <StatCard
                    title="Avg Order"
                    value={format(totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0)}
                    icon={TrendingUp}
                  />
                  <StatCard
                    title="Bank Balance"
                    value={format(bankBal)}
                    icon={Landmark}
                    iconBg={bankBal >= 0 ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-red-100 dark:bg-red-900/40"}
                    iconColor={bankBal >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
                  />
                </div>
              )}

              {/* ── ACTION SECTIONS ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

                {/* CASH DRAWER */}
                {isAdmin && (
                  <SectionCard icon={Wallet} title="Cash Drawer" description="Manage physical cash in drawer">
                    <ActionTile
                      icon={ArrowUpRight}
                      iconBg="bg-amber-500/10"
                      iconClass="text-amber-600"
                      label="Withdraw Cash"
                      desc="Remove cash from drawer"
                      onClick={() => setWithdrawOpen(true)}
                    />
                    <ActionTile
                      icon={ArrowDownLeft}
                      iconBg="bg-emerald-500/10"
                      iconClass="text-emerald-600"
                      label="Add Cash"
                      desc="Deposit into drawer"
                      onClick={() => setDepositOpen(true)}
                    />
                    <ActionTile
                      icon={DollarSign}
                      iconBg="bg-primary/10"
                      iconClass="text-primary"
                      label="View Drawer Cash"
                      desc="See real-time balance"
                      onClick={() => setCashDialog(true)}
                    />
                    {enableCashRecount && (
                      <ActionTile
                        icon={RefreshCw}
                        iconBg="bg-primary/10"
                        iconClass="text-primary"
                        label="Recount Cash"
                        desc="Recalculate drawer total"
                        onClick={() => setRecountOpen(true)}
                      />
                    )}
                    {useBusinessDay && currentDay && (
                      <ActionTile
                        icon={XCircle}
                        iconBg="bg-red-500/10"
                        iconClass="text-red-600"
                        label="Close Business Day"
                        desc="Finalise and close day"
                        onClick={() => setCloseDialogOpen(true)}
                        danger
                      />
                    )}
                  </SectionCard>
                )}

                {/* BANK ACCOUNT */}
                {isAdmin && (
                  <SectionCard icon={Landmark} title="Bank Account" description="Manage bank transactions">
                    <ActionTile
                      icon={ArrowDownLeft}
                      iconBg="bg-emerald-500/10"
                      iconClass="text-emerald-600"
                      label="Bank Deposit"
                      desc="Add money to bank"
                      onClick={() => setBankDepositOpen(true)}
                    />
                    <ActionTile
                      icon={ArrowUpRight}
                      iconBg="bg-red-500/10"
                      iconClass="text-red-600"
                      label="Bank Withdraw"
                      desc="Remove money from bank"
                      onClick={() => setBankWithdrawOpen(true)}
                    />
                    <ActionTile
                      icon={ArrowRightLeft}
                      iconBg="bg-primary/10"
                      iconClass="text-primary"
                      label="Cash → Bank"
                      desc="Move drawer cash to bank"
                      onClick={() => setCashToBankOpen(true)}
                    />
                    <ActionTile
                      icon={ArrowRightLeft}
                      iconBg="bg-primary/10"
                      iconClass="text-primary"
                      label="Bank → Cash"
                      desc="Withdraw bank to drawer"
                      onClick={() => setBankToCashOpen(true)}
                    />
                    <ActionTile
                      icon={History}
                      iconBg="bg-primary/10"
                      iconClass="text-primary"
                      label="Bank History"
                      desc="All bank transactions"
                      onClick={() => navigate("/bank-history")}
                    />
                  </SectionCard>
                )}

                {/* QUICK LINKS */}
                {isAdmin && (
                  <SectionCard icon={Link2} title="Quick Links" description="Jump to key areas">
                    <ActionTile
                      icon={ShoppingBag}
                      iconBg="bg-amber-500/10"
                      iconClass="text-amber-600"
                      label="Unpaid Orders"
                      desc="Pending customer payments"
                      onClick={() => navigate("/unpaid")}
                    />
                    <ActionTile
                      icon={Trash2}
                      iconBg="bg-red-500/10"
                      iconClass="text-red-600"
                      label="Deleted Orders"
                      desc="View & restore deleted bills"
                      onClick={() => navigate("/deleted-orders")}
                    />
                    <ActionTile
                      icon={History}
                      iconBg="bg-red-500/10"
                      iconClass="text-red-600"
                      label="Withdrawal History"
                      desc="Cash removed today"
                      onClick={() => navigate("/withdrawals-history")}
                    />
                    <ActionTile
                      icon={History}
                      iconBg="bg-emerald-500/10"
                      iconClass="text-emerald-600"
                      label="Deposit History"
                      desc="Cash added today"
                      onClick={() => navigate("/withdrawals-history")}
                    />
                  </SectionCard>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ================================================================
          DIALOGS — all logic preserved, inputs polished
      ================================================================ */}

      {/* DRAWER CASH */}
      <Dialog open={cashDialog} onOpenChange={setCashDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Current Drawer Cash</DialogTitle>
            <DialogDescription>Real-time cash currently inside drawer.</DialogDescription>
          </DialogHeader>
          {drawerCash ? (
            <div className="space-y-4">
              <div className="text-2xl font-bold text-foreground text-center">
                {format(drawerCash.total)}
              </div>
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <CashBreakdownDisplay breakdown={drawerCash.breakdown} />
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CLOSE DAY */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="w-full max-w-md md:max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Close Business Day</DialogTitle>
            <DialogDescription>Count physical cash in drawer before closing.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[40vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={closingBreakdown} setBreakdown={setClosingBreakdown} />
          </div>
          <div className="mt-4 space-y-1 text-center">
            <p className="text-xl font-bold">Closing Count: {format(closingTotal)}</p>
            <p className="text-sm text-muted-foreground">Expected (Ledger): {format(expectedCash)}</p>
            <p className={cn("text-sm font-semibold", hasMismatch ? "text-red-600" : "text-emerald-600")}>
              Difference: {format(difference)}
            </p>
          </div>
          {hasMismatch && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-red-600 mb-1.5">Cash Mismatch Reason (Required)</label>
              <textarea
                className={cn(inputCls, "resize-none")}
                rows={3}
                placeholder="Explain why cash mismatch occurred..."
                value={closingReason}
                onChange={(e) => setClosingReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onCloseDay} disabled={isClosing}>
              {isClosing ? "Closing…" : "Confirm Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WITHDRAW CASH */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="w-full max-w-md md:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Withdraw Cash</DialogTitle>
            <DialogDescription>Select notes to withdraw from drawer.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[35vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={withdrawBreakdown} setBreakdown={setWithdrawBreakdown} />
          </div>
          <div className="space-y-3 mt-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Withdrawal Reason</label>
              <select className={inputCls} value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value as WithdrawalReason | "")}>
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
            </div>
            {settings?.enable_partners && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Select Partner</label>
                <select className={inputCls} value={withdrawPartnerId ?? ""} onChange={(e) => setWithdrawPartnerId(Number(e.target.value))}>
                  <option value="">No partner</option>
                  {partners?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                Description {withdrawReason === "Other" && <span className="text-red-500">*</span>}
              </label>
              <textarea className={cn(inputCls, "resize-none")} rows={2} placeholder="Enter details…" value={withdrawDescription} onChange={(e) => setWithdrawDescription(e.target.value)} />
            </div>
          </div>
          <p className="text-lg font-bold text-center pt-2">Total: {format(withdrawTotal)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={handleWithdraw}>Confirm Withdrawal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DEPOSIT CASH */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="w-full max-w-md md:max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add Cash to Drawer</DialogTitle>
            <DialogDescription>Add denominations to drawer (mid-day refill).</DialogDescription>
          </DialogHeader>
          <div className="max-h-[40vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={depositBreakdown} setBreakdown={setDepositBreakdown} />
          </div>
          <p className="text-lg font-bold text-center pt-3">Total: {format(depositTotal)}</p>
          {settings?.enable_partners && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Select Partner</label>
              <select className={inputCls} value={depositPartnerId ?? ""} onChange={(e) => setDepositPartnerId(Number(e.target.value))}>
                <option value="">No partner</option>
                {partners?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!depositBreakdown.some((n) => n.qty > 0)) { toastError("Select at least one denomination."); return; }
              depositCash(
                { partnerId: depositPartnerId ?? null, breakdown: depositBreakdown, reason: "Drawer Refill" },
                { onSuccess: () => { setDepositOpen(false); setDepositBreakdown(denoms.map((d) => ({ note: d, qty: 0 }))); setDepositPartnerId(null); } }
              );
            }}>
              Confirm Deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OPEN DAY */}
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent className="w-full max-w-md md:max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Open Business Day</DialogTitle>
            <DialogDescription>Enter opening cash denominations.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={denominations} setBreakdown={setDenominations} />
          </div>
          <p className="text-center text-xl font-bold mt-4">Opening Cash: {format(openingTotal)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialogOpen(false)}>Cancel</Button>
            <Button onClick={onOpenDay} disabled={isOpening}>
              {isOpening ? "Opening…" : "Confirm Open"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RECOUNT */}
      <Dialog open={recountOpen} onOpenChange={setRecountOpen}>
        <DialogContent className="w-full max-w-md md:max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Recount Drawer Cash</DialogTitle>
            <DialogDescription>Enter actual denominations currently in drawer.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={recountBreakdown} setBreakdown={setRecountBreakdown} />
          </div>
          <p className="text-center text-xl font-bold mt-4">Total Cash: {format(recountTotal)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecountOpen(false)}>Cancel</Button>
            <Button onClick={handleRecount}>Update Drawer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BANK DEPOSIT */}
      <Dialog open={bankDepositOpen} onOpenChange={setBankDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank Deposit</DialogTitle>
            <DialogDescription>Add money to bank account</DialogDescription>
          </DialogHeader>
          <Input placeholder="Amount" type="number" value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} />
          <textarea className={cn(inputCls, "resize-none mt-3")} placeholder="Description (optional)" value={bankDesc} onChange={(e) => setBankDesc(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDepositOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!bankAmount) return;
              bankTx({ amount: Number(bankAmount), type: "credit", source: "owner_deposit", description: bankDesc });
              setBankDepositOpen(false); setBankAmount(""); setBankDesc("");
            }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BANK WITHDRAW */}
      <Dialog open={bankWithdrawOpen} onOpenChange={setBankWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank Withdraw</DialogTitle>
            <DialogDescription>Withdraw money from bank</DialogDescription>
          </DialogHeader>
          <Input placeholder="Amount" type="number" value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} />
          <textarea className={cn(inputCls, "resize-none mt-3")} placeholder="Reason" value={bankDesc} onChange={(e) => setBankDesc(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankWithdrawOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (!bankAmount) return;
              bankTx({ amount: Number(bankAmount), type: "debit", source: "owner_withdraw", description: bankDesc });
              setBankWithdrawOpen(false); setBankAmount(""); setBankDesc("");
            }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CASH → BANK */}
      <Dialog open={cashToBankOpen} onOpenChange={setCashToBankOpen}>
        <DialogContent className="w-full max-w-md md:max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Cash → Bank</DialogTitle>
            <DialogDescription>Move cash from drawer to bank account</DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={withdrawBreakdown} setBreakdown={setWithdrawBreakdown} />
          </div>
          <p className="text-center font-bold mt-4">Total: {format(withdrawTotal)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashToBankOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!withdrawTotal) return;
              const denominationsObj: any = {};
              withdrawBreakdown.forEach((d) => { if (d.qty > 0) denominationsObj[d.note] = d.qty; });
              bankTx({ amount: withdrawTotal, type: "credit", source: "cash_transfer", denominations: denominationsObj });
              setCashToBankOpen(false);
              setWithdrawBreakdown(denoms.map((d) => ({ note: d, qty: 0 })));
            }}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BANK → CASH */}
      <Dialog open={bankToCashOpen} onOpenChange={setBankToCashOpen}>
        <DialogContent className="w-full max-w-md md:max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Bank → Cash</DialogTitle>
            <DialogDescription>Withdraw cash from bank to drawer</DialogDescription>
          </DialogHeader>
          <div className="max-h-[45vh] overflow-y-auto pr-2">
            <DenominationSelector breakdown={depositBreakdown} setBreakdown={setDepositBreakdown} />
          </div>
          <p className="text-center font-bold mt-4">Total: {format(depositTotal)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankToCashOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!depositTotal) return;
              const denominationsObj: any = {};
              depositBreakdown.forEach((d) => { if (d.qty > 0) denominationsObj[d.note] = d.qty; });
              bankTx({ amount: depositTotal, type: "debit", source: "bank_to_cash", denominations: denominationsObj });
              setBankToCashOpen(false);
              setDepositBreakdown(denoms.map((d) => ({ note: d, qty: 0 })));
            }}>Withdraw Cash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
