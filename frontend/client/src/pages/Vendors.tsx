import { Sidebar } from "@/components/Sidebar";
import { useCurrency, useDenominations } from "@/hooks/use-currency";
import {
  useVendorSummary,
  useCreateVendor,
  useVendorUnpaid,
  useSettleVendor,
  useVendorSettlements,
} from "@/hooks/use-vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { DenominationSelector } from "@/components/DenominationSelector";
import {
  Select, SelectItem, SelectTrigger, SelectValue, SelectContent,
} from "@/components/ui/select";
import { usePartners } from "@/hooks/use-partners";
import { toastError } from "@/hooks/use-toast";
import {
  Store, Plus, ChevronRight, CheckCircle2, Clock, Loader2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";

const PM_LABEL: Record<string, string> = {
  cash: "Cash", online: "Online", card: "Card / EFTPOS",
};

export default function Vendors() {
  const { format } = useCurrency();
  const denoms = useDenominations();
  const { data: vendors, isLoading } = useVendorSummary();
  const { mutate: createVendor, isPending: isCreating } = useCreateVendor();
  const { data: partners } = usePartners();

  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partnerId, setPartnerId] = useState<number | null>(null);

  const { data: unpaid } = useVendorUnpaid(selectedVendor?.id);
  const { mutate: settleVendor, isPending: isSettling } = useSettleVendor(selectedVendor?.id);
  const { data: settlements } = useVendorSettlements(selectedVendor?.id);

  const [selectedExpenses, setSelectedExpenses] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "online" | "cash">("online");
  const [deductFromGalla, setDeductFromGalla] = useState(false);
  const [finalAmount, setFinalAmount] = useState(0);
  const [selectedNotes, setSelectedNotes] = useState(
    () => denoms.map((d) => ({ note: d, qty: 0 }))
  );

  const totalSelected =
    unpaid?.filter((e: any) => selectedExpenses.includes(e.id))
      .reduce((s: number, e: any) => s + parseFloat(e.amount), 0) || 0;

  useEffect(() => { setFinalAmount(totalSelected); }, [totalSelected]);

  useEffect(() => {
    if (paymentMethod === "cash" && deductFromGalla) {
      setFinalAmount(selectedNotes.reduce((s, n) => s + n.note * n.qty, 0));
    }
  }, [selectedNotes, paymentMethod, deductFromGalla]);

  useEffect(() => {
    if (paymentMethod === "cash" && deductFromGalla) setPartnerId(null);
  }, [paymentMethod, deductFromGalla]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createVendor({ name: name.trim(), phone }, {
      onSuccess: () => { setName(""); setPhone(""); },
    });
  };

  const toggleExpense = (id: number) =>
    setSelectedExpenses((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );

  const handleSettle = () => {
    if (!finalAmount || finalAmount <= 0) return;
    if (finalAmount > totalSelected) {
      toastError("Settlement amount cannot exceed total due"); return;
    }
    if (paymentMethod === "cash" && deductFromGalla) {
      const calc = selectedNotes.reduce((s, n) => s + n.note * n.qty, 0);
      if (calc !== finalAmount) {
        toastError("Selected denominations do not match final amount"); return;
      }
    }
    const denominationObject = Object.fromEntries(
      selectedNotes.filter((n) => n.qty > 0).map((n) => [n.note, n.qty])
    );
    settleVendor({
      expenseIds: selectedExpenses,
      payment_method: paymentMethod,
      final_amount: finalAmount,
      deduct_from_galla: deductFromGalla,
      partnerId,
      ...(paymentMethod === "cash" && deductFromGalla && { denominations: denominationObject }),
    });
    setSelectedExpenses([]);
    setFinalAmount(0);
    setDeductFromGalla(false);
    setPartnerId(null);
    setSelectedNotes(denoms.map((d: number) => ({ note: d, qty: 0 })));
  };

  const fmtDate = (raw: string) => {
    try {
      const d = raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
      return formatDate(d, "MMM d, yyyy");
    } catch { return "—"; }
  };

  // ── VENDOR DETAIL VIEW ──────────────────────────────────────────────────
  if (selectedVendor) {
    const unpaidList = unpaid ?? [];
    const settlementList = settlements ?? [];

    return (
      <div className="flex bg-background min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-0 lg:ml-60 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          <div className="w-full">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0"
              onClick={() => { setSelectedVendor(null); setSelectedExpenses([]); }}>
              <ArrowLeft className="w-4 h-4" /> Vendors
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{selectedVendor.name}</h1>
              {selectedVendor.phone && (
                <p className="text-sm text-muted-foreground">{selectedVendor.phone}</p>
              )}
            </div>
          </div>

          {/* Balance summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-card rounded-2xl border border-border/60 p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Outstanding</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {format(selectedVendor.total_unpaid)}
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border/60 p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Total Paid</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {format(selectedVendor.total_paid)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Unpaid expenses ── */}
            <div>
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-semibold text-sm text-foreground">Unpaid Expenses</h2>
                  </div>
                  {unpaidList.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedExpenses(
                          selectedExpenses.length === unpaidList.length
                            ? []
                            : unpaidList.map((e: any) => e.id)
                        )
                      }
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      {selectedExpenses.length === unpaidList.length ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>

                {unpaidList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No outstanding expenses
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {unpaidList.map((expense: any) => (
                      <button
                        key={expense.id}
                        onClick={() => toggleExpense(expense.id)}
                        className={cn(
                          "w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                          selectedExpenses.includes(expense.id)
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/50 bg-muted/30 hover:border-primary/30 hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={selectedExpenses.includes(expense.id)}
                          onCheckedChange={() => toggleExpense(expense.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{expense.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtDate(expense.created_at)}
                            {expense.uploaded_by && <span className="ml-1 opacity-70">· {expense.uploaded_by}</span>}
                          </p>
                        </div>
                        <p className="font-bold text-red-600 dark:text-red-400 text-sm shrink-0">
                          {format(expense.amount)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Settlement form — only when expenses selected */}
              {selectedExpenses.length > 0 && (
                <div className="mt-4 bg-card rounded-2xl border border-primary/30 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {selectedExpenses.length} expense{selectedExpenses.length !== 1 ? "s" : ""} selected
                    </p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {format(totalSelected)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                        Payment Method
                      </label>
                      <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {!(paymentMethod === "cash" && deductFromGalla) && partners && partners.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                          Paid By
                        </label>
                        <Select
                          value={partnerId ? String(partnerId) : "staff"}
                          onValueChange={(v) => setPartnerId(v === "staff" ? null : Number(v))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select payer" /></SelectTrigger>
                          <SelectContent>
                            {partners.map((p: any) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <Input
                    type="number"
                    placeholder="Final amount paid"
                    value={finalAmount}
                    disabled={paymentMethod === "cash" && deductFromGalla}
                    onChange={(e) => setFinalAmount(Number(e.target.value))}
                  />

                  {paymentMethod === "cash" && (
                    <div className="flex items-center gap-2.5 bg-muted/40 rounded-xl p-3">
                      <Checkbox
                        checked={deductFromGalla}
                        onCheckedChange={(v) => setDeductFromGalla(!!v)}
                      />
                      <label className="text-sm font-medium cursor-pointer">
                        Deduct from Galla (cash drawer)
                      </label>
                    </div>
                  )}

                  {paymentMethod === "cash" && deductFromGalla && (
                    <DenominationSelector
                      breakdown={selectedNotes}
                      setBreakdown={setSelectedNotes}
                      title="Cash Given"
                    />
                  )}

                  <Button className="w-full gap-2" onClick={handleSettle} disabled={isSettling}>
                    {isSettling
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                      : <><CheckCircle2 className="w-4 h-4" /> Confirm Settlement — {format(finalAmount)}</>
                    }
                  </Button>
                </div>
              )}
            </div>

            {/* ── Settlement history ── */}
            <div>
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-muted/20 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm text-foreground">Settlement History</h2>
                </div>
                {settlementList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No settlements yet
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {settlementList.map((s: any) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border/50 bg-muted/20"
                      >
                        <div>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            +{format(s.total_paid)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 uppercase">
                            {PM_LABEL[s.payment_method] ?? s.payment_method}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(s.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </main>
      </div>
    );
  }

  // ── HUB VIEW (vendor list) ──────────────────────────────────────────────
  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-60 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="w-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
              <Store className="w-6 h-6 text-primary shrink-0" />
              Vendors
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {vendors?.length ?? 0} vendor{(vendors?.length ?? 0) !== 1 ? "s" : ""} · click a card to view & settle
            </p>
          </div>
        </div>

        {/* Add vendor form */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-foreground mb-3">Add New Vendor</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Vendor name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1"
            />
            <Input
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1"
            />
            <Button
              disabled={!name.trim() || isCreating}
              onClick={handleCreate}
              className="gap-2 shrink-0"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Vendor grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin w-6 h-6 text-primary" />
          </div>
        ) : !vendors?.length ? (
          <div className="bg-card rounded-2xl border border-border/60 p-12 text-center">
            <Store className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground text-sm">No vendors yet — add your first one above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.map((vendor: any) => (
              <button
                key={vendor.id}
                onClick={() => { setSelectedVendor(vendor); setSelectedExpenses([]); }}
                className="bg-card rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-left p-5 group"
              >
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div>
                    <p className="font-semibold text-foreground">{vendor.name}</p>
                    {vendor.phone && (
                      <p className="text-xs text-muted-foreground mt-0.5">{vendor.phone}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition shrink-0 mt-0.5" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                    <p className="text-base font-bold text-red-600 dark:text-red-400">
                      {format(vendor.total_unpaid)}
                    </p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Paid</p>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {format(vendor.total_paid)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
