import { Sidebar } from "@/components/Sidebar";
import { useCurrency, useDenominations } from "@/hooks/use-currency";
import {
  useExpenses,
  useCreateExpense,
  useUploadExpenseImage,
  useDeleteExpense,
  useUpdateExpense,
} from "@/hooks/use-expenses";
import { DenominationSelector } from "@/components/DenominationSelector";
import { useStaff } from "@/hooks/use-staff";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import {
  Plus, Wallet, Eye, Download, Pencil, Trash2, ScanLine,
  Loader2, AlertTriangle, Search, Receipt,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format as formatDate } from "date-fns";
import { useVendorSummary } from "@/hooks/use-vendors";
import { withUploads } from "@/lib/api-base";
import { usePartners } from "@/hooks/use-partners";
import { cn } from "@/lib/utils";

// ── category meta ─────────────────────────────────────────────────────────────
const CAT_META: Record<string, { label: string; color: string; dot: string }> = {
  supplies:      { label: "Supplies",      color: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",   dot: "bg-blue-500" },
  salary:        { label: "Salary",        color: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  utility:       { label: "Utility",       color: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  miscellaneous: { label: "Miscellaneous", color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const PM_LABEL: Record<string, string> = {
  cash: "Cash", online: "Online", card: "Card",
};

export default function Expenses() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { format } = useCurrency();
  const denoms = useDenominations();
  const { data: currentDay } = useCurrentBusinessDay(true);
  const { data: expenses, isLoading } = useExpenses(true, currentDay?.id);
  const { mutate: createExpense, isPending } = useCreateExpense(true);
  const { mutate: updateExpense } = useUpdateExpense(true);
  const { data: partners } = usePartners();
  const uploadImage = useUploadExpenseImage();
  const { data: vendors } = useVendorSummary();
  const vendorsList = vendors ?? [];
  const { data: staff } = useStaff();
  const { mutate: deleteExpense } = useDeleteExpense();

  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deductFromGalla, setDeductFromGalla] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [selectedNotes, setSelectedNotes] = useState(
    () => denoms.map((d) => ({ note: d, qty: 0 }))
  );

  const form = useForm({
    defaultValues: {
      description: "",
      amount: 0,
      category: "supplies",
      paymentMode: "online",
      vendorId: "",
      utilityType: "",
      isPaid: false,
      staff_id: "",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const selectedCategory = form.watch("category");
  const paymentMode = form.watch("paymentMode");

  useEffect(() => {
    if (paymentMode === "cash" && deductFromGalla) {
      const total = selectedNotes.reduce((s, n) => s + n.note * n.qty, 0);
      form.setValue("amount", total);
    }
  }, [selectedNotes, deductFromGalla, paymentMode]);

  useEffect(() => {
    if (paymentMode === "cash" && deductFromGalla) form.setValue("isPaid", true);
  }, [deductFromGalla, paymentMode]);

  useEffect(() => {
    if (paymentMode === "cash" && deductFromGalla) setPartnerId(null);
  }, [deductFromGalla, paymentMode]);

  const resetDialog = () => {
    setEditingExpense(null);
    setPartnerId(null);
    setUploadedUrl(null);
    setDeductFromGalla(false);
    setSelectedNotes(denoms.map((d) => ({ note: d, qty: 0 })));
    form.reset({
      description: "", amount: 0, category: "supplies",
      paymentMode: "online", vendorId: "", utilityType: "",
      isPaid: false, staff_id: "",
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const handleScanBill = async (file: File) => {
    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/expenses/scan-bill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Scan failed");
      const data = await res.json();

      // Build description from line items if available, else fall back to vendor name
      const items: Array<{ name: string; qty?: number; total?: number }> = Array.isArray(data.items) ? data.items : [];
      let description = "";
      if (items.length === 1) {
        description = items[0].name ?? "";
      } else if (items.length > 1) {
        description = items.map(i => i.qty ? `${i.name} x${i.qty}` : i.name).join(", ");
      }
      if (!description && data.vendor_name) description = data.vendor_name;

      const amount = data.total_amount ?? data.amount;
      if (amount) form.setValue("amount", Number(amount));
      if (description) form.setValue("description", description);
      if (data.date) form.setValue("date", data.date);
      if (data.category && ["supplies","utility","miscellaneous","salary"].includes(data.category))
        form.setValue("category", data.category);
      // Auto-fill vendor if matched
      if (data.vendor_id) form.setValue("vendorId", String(data.vendor_id));
      if (data.document_url) setUploadedUrl(data.document_url);
    } catch { /* silent — user fills manually */ }
    finally { setIsScanning(false); }
  };

  const onSubmit = (data: any) => {
    if (!currentDay) return;
    if (!data.description.trim()) { toastError("Description is required"); return; }
    if (data.amount <= 0) { toastError("Amount must be greater than 0"); return; }

    const denominationObject = Object.fromEntries(
      selectedNotes.filter((n) => n.qty > 0).map((n) => [n.note, n.qty])
    );
    const payload = {
      ...data,
      date: data.date ? new Date(data.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      vendorId: data.vendorId ? Number(data.vendorId) : null,
      staff_id: data.staff_id ? Number(data.staff_id) : null,
      partnerId,
      is_paid: data.isPaid,
      businessDayId: currentDay.id,
      document_url: uploadedUrl,
      deduct_from_galla: deductFromGalla,
      source: "manual",
      ...(data.paymentMode === "cash" && deductFromGalla && { denominations: denominationObject }),
    };

    if (editingExpense) {
      updateExpense({ id: editingExpense.id, ...payload }, {
        onSuccess: () => { setOpen(false); resetDialog(); },
      });
    } else {
      createExpense(payload, {
        onSuccess: () => { setOpen(false); resetDialog(); },
      });
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setUploadedUrl(expense.document_url || null);
    setPartnerId(expense.partner_id || null);
    form.reset({
      description: expense.description,
      amount: Number(expense.amount),
      category: expense.category,
      paymentMode: expense.payment_method,
      vendorId: expense.vendor_id?.toString() || "",
      staff_id: expense.staff_id?.toString() || "",
      utilityType: expense.utility_type || "",
      isPaid: expense.is_paid || false,
      date: expense.expense_date || new Date(expense.created_at).toISOString().slice(0, 10),
    });
    setOpen(true);
  };

  // ── derived ──────────────────────────────────────────────────────────────
  const filteredExpenses = (expenses ?? []).filter((e: any) => {
    const term = searchTerm.toLowerCase();
    const matchesCat = filterCategory ? e.category === filterCategory : true;
    const matchesSearch =
      e.description?.toLowerCase().includes(term) ||
      e.vendor_name?.toLowerCase().includes(term) ||
      e.staff_name?.toLowerCase().includes(term);
    return matchesCat && (term ? matchesSearch : true);
  });

  const totalAll = (expenses ?? []).reduce((s: number, e: any) => s + Number(e.amount), 0);

  const formatExpenseDate = (expense: any) => {
    const raw = expense.expense_date || expense.created_at;
    if (!raw) return "—";
    const d = raw.length === 10 ? new Date(raw + "T00:00:00") : new Date(raw);
    return isNaN(d.getTime()) ? "—" : formatDate(d, "MMM d, yyyy");
  };

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-0 lg:ml-60 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="w-full">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
              <Receipt className="w-6 h-6 text-primary shrink-0" />
              Expenses
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""}
              {filterCategory ? ` · ${CAT_META[filterCategory]?.label}` : ""} · Total{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">{format(totalAll)}</span>
            </p>
          </div>

          {isAdmin && (
            <Button
              disabled={!currentDay}
              className="gap-2 shrink-0"
              onClick={() => { resetDialog(); setOpen(true); }}
            >
              <Plus className="w-4 h-4" /> Add Expense
            </Button>
          )}
        </div>

        {/* ── Category summary filter ── */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {["supplies", "salary", "utility", "miscellaneous"].map((cat) => {
              const total = (expenses ?? [])
                .filter((e: any) => e.category === cat)
                .reduce((s: number, e: any) => s + Number(e.amount), 0);
              const meta = CAT_META[cat];
              const active = filterCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(active ? null : cat)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all hover:shadow-md",
                    active
                      ? "border-primary ring-1 ring-primary/30 bg-primary/5"
                      : "border-border/60 bg-card hover:border-primary/20"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", meta.dot)} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                    {format(total)}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Search ── */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by description, vendor, or staff…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* ── List ── */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin w-6 h-6 text-primary" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border/60 p-12 text-center">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground text-sm">No expenses found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense: any) => {
              const meta = CAT_META[expense.category] ?? CAT_META.miscellaneous;
              return (
                <div
                  key={expense.id}
                  className="bg-card rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 transition-all p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* Left: icon + info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5 text-red-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground text-sm">
                          {expense.description}
                        </span>
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", meta.color)}>
                          {meta.label}
                        </span>
                        {expense.is_paid && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                            Paid
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-1">
                        {expense.vendor_name && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {expense.vendor_name}
                          </span>
                        )}
                        {expense.staff_name && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300">
                            {expense.staff_name}
                          </span>
                        )}
                        {expense.partner_name && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {expense.partner_name}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatExpenseDate(expense)}
                        {expense.created_by && (
                          <span className="opacity-70 ml-1">· by {expense.created_by}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: amount + actions */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-between sm:justify-end w-full sm:w-auto">
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        -{format(expense.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground uppercase mt-0.5">
                        {PM_LABEL[expense.payment_method] ?? expense.payment_method}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {expense.document_url && (
                        <>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => setPreviewUrl(withUploads(expense.document_url))}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <a href={withUploads(expense.document_url)} download>
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          </a>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <Button
                            variant="outline" size="sm"
                            disabled={expense.is_paid}
                            onClick={() => handleEdit(expense)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            disabled={expense.is_paid}
                            className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 disabled:opacity-40"
                            onClick={() => setDeleteTarget(expense.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </main>

      {/* ══════════════ ADD / EDIT DIALOG ══════════════ */}
      <Dialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) resetDialog();
        }}
      >
        <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Record New Expense"}</DialogTitle>
            <DialogDescription>
              {editingExpense ? "Update the expense details below." : "Fill in the details or scan a bill to auto-fill."}
            </DialogDescription>
          </DialogHeader>

          {/* Scan bill */}
          <input
            ref={scanInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleScanBill(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed border-2 text-primary hover:bg-primary/5 gap-2"
            disabled={isScanning}
            onClick={() => scanInputRef.current?.click()}
          >
            {isScanning
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning bill…</>
              : <><ScanLine className="w-4 h-4" /> Scan Bill (auto-fill)</>
            }
          </Button>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="e.g. Chicken stock, Electricity bill…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        disabled={paymentMode === "cash" && deductFromGalla}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" max={new Date().toISOString().slice(0, 10)} {...field} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Category + conditional sub-field */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="salary">Salary</SelectItem>
                        <SelectItem value="utility">Utility</SelectItem>
                        <SelectItem value="miscellaneous">Miscellaneous</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {selectedCategory === "supplies" && (
                  <FormField control={form.control} name="vendorId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <Select value={String(field.value)} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {vendorsList.map((v: any) => (
                            <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                )}
                {selectedCategory === "salary" && (
                  <FormField control={form.control} name="staff_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Member</FormLabel>
                      <Select value={String(field.value || "")} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {staff?.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                )}
                {selectedCategory === "utility" && (
                  <FormField control={form.control} name="utilityType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Utility Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="rent">Rent</SelectItem>
                          <SelectItem value="electricity">Electricity</SelectItem>
                          <SelectItem value="water">Water</SelectItem>
                          <SelectItem value="internet">Internet</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                )}
              </div>

              {/* Payment Mode + Paid By */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="paymentMode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Mode</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {partners && partners.length > 0 && paymentMode === "cash" && !deductFromGalla && (
                  <div>
                    <label className="text-sm font-medium">Paid By</label>
                    <Select
                      value={partnerId ? String(partnerId) : "staff"}
                      onValueChange={(value) => setPartnerId(value === "staff" ? null : Number(value))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select payer" />
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Mark as paid + Deduct from galla */}
              <div className="flex flex-col gap-3 bg-muted/30 rounded-xl p-3">
                <FormField control={form.control} name="isPaid" render={({ field }) => {
                  const forced = paymentMode === "cash" && deductFromGalla;
                  if (forced && !field.value) field.onChange(true);
                  return (
                    <FormItem className="flex items-center gap-2.5 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={forced ? true : field.value}
                          disabled={forced}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-medium cursor-pointer">
                        Mark as Paid
                        {forced && <span className="text-xs text-emerald-600 ml-2">(Auto — Galla)</span>}
                      </FormLabel>
                    </FormItem>
                  );
                }} />

                {paymentMode === "cash" && (
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      checked={deductFromGalla}
                      onCheckedChange={(v) => setDeductFromGalla(!!v)}
                    />
                    <label className="text-sm font-medium cursor-pointer">Deduct from Galla (cash drawer)</label>
                  </div>
                )}
              </div>

              {paymentMode === "cash" && deductFromGalla && (
                <DenominationSelector
                  breakdown={selectedNotes}
                  setBreakdown={setSelectedNotes}
                  title="Cash Used"
                />
              )}

              {/* Bill upload */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Upload Bill <span className="text-muted-foreground font-normal">(photo or image)</span>
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={async (e) => {
                    if (!e.target.files?.length) return;
                    const file = e.target.files[0];
                    try {
                      const url = await uploadImage(file);
                      setUploadedUrl(url);
                    } catch { /* silent */ }
                  }}
                />
                {uploadedUrl && (
                  <img src={withUploads(uploadedUrl)} className="mt-3 w-20 h-20 object-cover rounded-lg border" />
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : (editingExpense ? "Update Expense" : "Record Expense")}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Bill preview ── */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bill Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && <img src={previewUrl} className="w-full h-auto rounded-xl" />}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <DialogTitle>Delete Expense?</DialogTitle>
            </div>
            <DialogDescription>
              This expense will be permanently deleted and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                if (deleteTarget !== null) deleteExpense(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
