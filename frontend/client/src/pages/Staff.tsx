import { Sidebar } from "@/components/Sidebar";
import { useCurrency, useDenominations } from "@/hooks/use-currency";
import {
  useStaffWithBalance, Staff as StaffType, useStaffSummary,
  useStaffTransaction, useStaffHistory, useStaffAdvanceHistory,
  useUpdateStaff, useDeleteStaff,
} from "@/hooks/use-staff";
import { useCreateStaff } from "@/hooks/use-staff";
import { useCreateAdvance } from "@/hooks/use-payroll";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectItem, SelectTrigger, SelectValue, SelectContent,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { DenominationSelector } from "@/components/DenominationSelector";
import { StatCard } from "@/components/StatCard";
import {
  Users, Wallet, DollarSign, AlertTriangle, TrendingUp,
  UserCheck, CreditCard, Banknote,
} from "lucide-react";
import { usePartners } from "@/hooks/use-partners";
import { cn } from "@/lib/utils";

export default function Staff() {
  const { format } = useCurrency();
  const denoms = useDenominations();
  const { data: settings } = useSettings();
  const isAUD = settings?.currency_code === "AUD";
  const { data: currentDay } = useCurrentBusinessDay(true);
  const { data: staff } = useStaffWithBalance();
  const { mutate: createStaff } = useCreateStaff();
  const { mutate: addTransaction } = useStaffTransaction();
  const { data: summary } = useStaffSummary();
  const { mutate: updateStaff } = useUpdateStaff();
  const { data: partners } = usePartners();
  const { mutate: deactivateStaff } = useDeleteStaff();
  const { mutate: createAdvance, isPending: creatingAdvance } = useCreateAdvance();

  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffType | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [type, setType] = useState<"payment" | "adjustment">("payment");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "online">("cash");
  const [deductFromGalla, setDeductFromGalla] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStaff, setHistoryStaff] = useState<StaffType | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffType | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", role: "", phone: "", salary: "", joining_date: "",
  });
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceStaff, setAdvanceStaff] = useState<StaffType | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceSource, setAdvanceSource] = useState<"galla" | "external">("external");
  const [advanceDenoms, setAdvanceDenoms] = useState(() => denoms.map(d => ({ note: d, qty: 0 })));
  const advanceDenomTotal = advanceDenoms.reduce((s, d) => s + d.note * d.qty, 0);

  const { data: history } = useStaffHistory(!isAUD ? (historyStaff?.id ?? undefined) : undefined);
  const { data: advanceHistory } = useStaffAdvanceHistory(isAUD ? (historyStaff?.id ?? undefined) : undefined);
  const [selectedNotes, setSelectedNotes] = useState(() => denoms.map(d => ({ note: d, qty: 0 })));

  const [open, setOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: "", role: "", phone: "", salary: "", joining_date: "",
    opening_balance: "", email: "", password: "",
  });

  const openTransactionModal = (member: StaffType) => {
    setSelectedStaff(member);
    setAmount(0);
    setReason("");
    setType("payment");
    setTransactionOpen(true);
  };

  const openEditModal = (member: StaffType) => {
    setEditStaff(member);
    setEditForm({
      name: member.name,
      role: member.role || "",
      phone: member.phone || "",
      salary: String(member.salary),
      joining_date: member.joining_date || "",
    });
    setEditOpen(true);
  };

  useEffect(() => {
    if (paymentMethod === "cash" && deductFromGalla) setPartnerId(null);
  }, [paymentMethod, deductFromGalla]);

  return (
    <div className="flex bg-background min-h-screen pt-16 lg:pt-8">
      <Sidebar />
      <main className="flex-1 lg:ml-60 px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
              <Users className="w-6 h-6 text-primary shrink-0" />
              Staff Members
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage team, balances and payments
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>+ Add Staff</Button>
        </div>

        {/* ── Summary strip ── */}
        {isAUD ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <StatCard title="Pending Advances" value={format(summary?.pendingAdvances || 0)} icon={Banknote} />
            <StatCard title="Staff Count" value={String(staff?.length || 0)} icon={Users} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total Salary" value={format(summary?.totalSalary || 0)} icon={Wallet} />
            <StatCard title="Paid This Month" value={format(summary?.paidThisMonth || 0)} icon={DollarSign} />
            <StatCard title="Unpaid This Month" value={format(summary?.unpaidThisMonth ?? 0)} icon={AlertTriangle} />
            <StatCard title="Salary Credit" value={format(summary?.totalCredit || 0)} icon={TrendingUp} />
          </div>
        )}

        {/* ── Staff cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {staff?.map((member: StaffType) => {
            const balance = Number(member.balance);
            const isDue = balance > 0;
            return (
              <div
                key={member.id}
                className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer"
                onClick={() => { setHistoryStaff(member); setHistoryOpen(true); }}
              >
                {/* Card top */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground leading-tight">{member.name}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">{member.role}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-semibold shrink-0",
                    member.is_active
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                  )}>
                    {member.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Stats */}
                {isAUD ? (
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Pending Advance</span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        Number(member.advance_total) > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {format(Number(member.advance_total) || 0)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Salary</span>
                      <span className="font-medium tabular-nums">{format(member.salary)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Balance Due</span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        isDue
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {format(balance)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Balance status badge */}
                {isAUD ? (
                  <div className={cn(
                    "text-xs px-3 py-1.5 rounded-xl font-medium mb-4 text-center",
                    Number(member.advance_total) > 0
                      ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                      : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                  )}>
                    {Number(member.advance_total) > 0 ? "Advance Pending Payroll" : "No Pending Advances"}
                  </div>
                ) : (
                  <div className={cn(
                    "text-xs px-3 py-1.5 rounded-xl font-medium mb-4 text-center",
                    isDue
                      ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                      : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                  )}>
                    {isDue ? "Payment Due" : "Settled"}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {!isAUD && (
                    <Button size="sm" className="flex-1" onClick={() => openTransactionModal(member)}>
                      <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Pay
                    </Button>
                  )}
                  {isAUD && (
                    <Button size="sm" className="flex-1" variant="outline" onClick={() => {
                      setAdvanceStaff(member);
                      setAdvanceAmount("");
                      setAdvanceSource("external");
                      setAdvanceDenoms(denoms.map(d => ({ note: d, qty: 0 })));
                      setAdvanceOpen(true);
                    }}>
                      <Banknote className="w-3.5 h-3.5 mr-1.5" /> Cash Advance
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditModal(member)}>
                    Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Add Staff Dialog ── */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Staff</DialogTitle>
              <DialogDescription>Add a team member to the system.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Name *" value={newStaff.name}
                onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} />
              <Input placeholder="Role" value={newStaff.role}
                onChange={e => setNewStaff({ ...newStaff, role: e.target.value })} />
              <Input placeholder="Phone" value={newStaff.phone}
                onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })} />
              {!isAUD && (
                <Input type="number" placeholder="Salary" value={newStaff.salary}
                  onChange={e => setNewStaff({ ...newStaff, salary: e.target.value })} />
              )}
              <Input type="date" value={newStaff.joining_date}
                onChange={e => setNewStaff({ ...newStaff, joining_date: e.target.value })} />
              {!isAUD && (
                <Input type="number" placeholder="Opening Balance (optional)" value={newStaff.opening_balance}
                  onChange={e => setNewStaff({ ...newStaff, opening_balance: e.target.value })} />
              )}

              <div className="border-t border-border/60 pt-3 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Login Credentials</p>
                <Input type="email" placeholder="Email" value={newStaff.email}
                  onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} />
                <Input type="password" placeholder="Password" value={newStaff.password}
                  onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} />
              </div>

              <Button className="w-full" disabled={!newStaff.name.trim()}
                onClick={() => {
                  if (!newStaff.name.trim()) return;
                  createStaff({
                    ...newStaff,
                    salary: Number(newStaff.salary),
                    opening_balance: newStaff.opening_balance ? Number(newStaff.opening_balance) : undefined,
                  }, {
                    onSuccess: () => {
                      setOpen(false);
                      setNewStaff({ name: "", role: "", phone: "", salary: "", joining_date: "", opening_balance: "", email: "", password: "" });
                    },
                  });
                }}>
                Save Staff
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Pay / Adjust Dialog ── */}
        <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pay / Adjust — {selectedStaff?.name}</DialogTitle>
              <DialogDescription>Record a payment or balance adjustment.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Transaction Type</label>
                <Select value={type} onValueChange={v => setType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">Payment (You Pay Staff)</SelectItem>
                    <SelectItem value="adjustment">Adjustment (Manual Correction)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!(paymentMethod === "cash" && deductFromGalla) && partners && partners.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Paid By</label>
                  <Select
                    value={partnerId ? String(partnerId) : "staff"}
                    onValueChange={v => setPartnerId(v === "staff" ? null : Number(v))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select payer" /></SelectTrigger>
                    <SelectContent>
                      {partners?.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
                <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === "cash" && (
                <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5">
                  <Checkbox
                    id="galla"
                    checked={deductFromGalla}
                    onCheckedChange={v => setDeductFromGalla(!!v)}
                  />
                  <label htmlFor="galla" className="text-sm cursor-pointer select-none">
                    Deduct from Galla
                  </label>
                </div>
              )}

              {paymentMethod === "cash" && deductFromGalla && (
                <DenominationSelector
                  breakdown={selectedNotes}
                  setBreakdown={setSelectedNotes}
                  title="Cash Used"
                />
              )}

              <Input type="number" placeholder="Amount" value={amount || ""}
                onChange={e => setAmount(Number(e.target.value))} />
              <Input placeholder="Reason" value={reason}
                onChange={e => setReason(e.target.value)} />

              <Button className="w-full" disabled={!selectedStaff || amount <= 0}
                onClick={() => {
                  if (!selectedStaff || amount <= 0) return;
                  const denominationObject = Object.fromEntries(
                    selectedNotes.filter(n => n.qty > 0).map(n => [n.note, n.qty])
                  );
                  addTransaction({
                    staffId: selectedStaff.id, amount, type, reason,
                    payment_method: paymentMethod, partnerId,
                    deduct_from_galla: deductFromGalla,
                    denominations: paymentMethod === "cash" && deductFromGalla ? denominationObject : undefined,
                    businessDayId: currentDay?.id ?? undefined,
                  }, {
                    onSuccess: () => {
                      setTransactionOpen(false);
                      setDeductFromGalla(false);
                      setSelectedNotes(denoms.map(d => ({ note: d, qty: 0 })));
                    },
                  });
                }}>
                Confirm
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── History Dialog ── */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                {isAUD ? "Cash Advances" : "Salary History"} — {historyStaff?.name}
              </DialogTitle>
              <DialogDescription>
                {isAUD
                  ? "Cash advances given. Settled advances are cleared when payroll is processed."
                  : "Complete payment and adjustment history."}
              </DialogDescription>
            </DialogHeader>

            {/* AUD: advance history */}
            {isAUD && (
              <div className="mt-2 space-y-2 max-h-100 overflow-y-auto pr-1">
                {advanceHistory?.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">No advances recorded.</p>
                )}
                {advanceHistory?.map((adv) => {
                  const settled = adv.payroll_batch_id !== null;
                  return (
                    <div key={adv.id}
                      className="border border-border/60 rounded-xl p-3.5 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Banknote className={cn("w-4 h-4", settled ? "text-emerald-500" : "text-amber-500")} />
                          <span className="font-medium text-sm">Cash Advance</span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            settled
                              ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                          )}>
                            {settled ? "Settled" : "Pending"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(adv.created_at).toLocaleString()}
                        </p>
                        {adv.notes && (
                          <p className="text-xs text-muted-foreground">{adv.notes}</p>
                        )}
                      </div>
                      <p className="font-semibold text-sm tabular-nums text-amber-600 dark:text-amber-400">
                        {format(adv.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* INR: salary transaction history */}
            {!isAUD && (
              <div className="mt-2 space-y-2 max-h-100 overflow-y-auto pr-1">
                {history?.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">No transactions found.</p>
                )}
                {history && (() => {
                  let runningBalance = 0;
                  return history.map((txn: any) => {
                    const isPayment = txn.type === "payment";
                    runningBalance = isPayment
                      ? runningBalance - Number(txn.amount)
                      : runningBalance + Number(txn.amount);
                    return (
                      <div key={txn.id}
                        className="border border-border/60 rounded-xl p-3.5 flex justify-between items-center">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            {isPayment
                              ? <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                            <span className="font-medium text-sm capitalize">{txn.type}</span>
                            {txn.payment_method && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                {txn.payment_method}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(txn.created_at).toLocaleString()}
                          </p>
                          {txn.reason && (
                            <p className="text-xs text-muted-foreground">{txn.reason}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-semibold text-sm tabular-nums",
                            isPayment
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          )}>
                            {format(txn.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Bal: {format(runningBalance)}
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Cash Advance Dialog ── */}
        <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-4 h-4" /> Cash Advance — {advanceStaff?.name}
              </DialogTitle>
              <DialogDescription>Record cash given to staff. Will be settled at payroll time.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {/* Source toggle */}
              <div className="flex rounded-xl border border-border/60 overflow-hidden text-sm">
                {([["external", "External Cash"], ["galla", "From Galla"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setAdvanceSource(val)}
                    className={cn("flex-1 px-3 py-2 transition-colors",
                      advanceSource === val ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* External cash: manual amount entry */}
              {advanceSource === "external" && (
                <Input
                  type="number"
                  placeholder="Amount *"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                />
              )}

              {/* Galla: denomination selector drives the amount */}
              {advanceSource === "galla" && (
                <DenominationSelector
                  breakdown={advanceDenoms}
                  setBreakdown={setAdvanceDenoms}
                  title="Cash Used from Galla"
                />
              )}

              <Button
                className="w-full"
                disabled={
                  creatingAdvance ||
                  (advanceSource === "external" && (!advanceAmount || Number(advanceAmount) <= 0)) ||
                  (advanceSource === "galla" && (!currentDay?.id || advanceDenomTotal <= 0))
                }
                onClick={() => {
                  if (!advanceStaff) return;
                  const finalAmount = advanceSource === "galla" ? advanceDenomTotal : Number(advanceAmount);
                  if (finalAmount <= 0) return;
                  const denominationObject = advanceSource === "galla"
                    ? Object.fromEntries(advanceDenoms.filter(n => n.qty > 0).map(n => [n.note, n.qty]))
                    : undefined;
                  createAdvance(
                    {
                      staff_id: advanceStaff.id,
                      amount: finalAmount,
                      deduct_from_galla: advanceSource === "galla",
                      denominations: denominationObject,
                    },
                    {
                      onSuccess: () => {
                        setAdvanceOpen(false);
                        setAdvanceAmount("");
                        setAdvanceDenoms(denoms.map(d => ({ note: d, qty: 0 })));
                      },
                    }
                  );
                }}
              >
                {creatingAdvance
                  ? "Recording…"
                  : advanceSource === "galla" && !currentDay?.id
                    ? "No active business day"
                    : "Record Advance"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Edit Staff Dialog ── */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Staff</DialogTitle>
              <DialogDescription>Update staff details or deactivate.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Name" value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              <Input placeholder="Role" value={editForm.role}
                onChange={e => setEditForm({ ...editForm, role: e.target.value })} />
              <Input placeholder="Phone" value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
              {!isAUD && (
                <Input type="number" placeholder="Salary" value={editForm.salary}
                  onChange={e => setEditForm({ ...editForm, salary: e.target.value })} />
              )}
              <Input type="date" value={editForm.joining_date}
                onChange={e => setEditForm({ ...editForm, joining_date: e.target.value })} />

              <Button className="w-full"
                onClick={() => {
                  if (!editStaff) return;
                  updateStaff({
                    id: editStaff.id,
                    name: editForm.name,
                    role: editForm.role,
                    phone: editForm.phone,
                    salary: Number(editForm.salary),
                    joining_date: editForm.joining_date,
                    is_active: true,
                  });
                  setEditOpen(false);
                }}>
                Save Changes
              </Button>
              <Button variant="destructive" className="w-full"
                onClick={() => {
                  if (!editStaff) return;
                  deactivateStaff(editStaff.id);
                  setEditOpen(false);
                }}>
                Deactivate Staff
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        </div>
      </main>
    </div>
  );
}
