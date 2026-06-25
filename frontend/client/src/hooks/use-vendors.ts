import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise, toastError, toastSuccess } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

// ================= TYPES =================

type PaymentMethod = "card" | "online" | "cash";

interface Vendor {
  id: number;
  name: string;
  phone?: string;
  is_active: boolean;
}

interface VendorSettlementPayload {
  expenseIds: number[];
  payment_method: PaymentMethod;
  final_amount: number;
  deduct_from_galla?: boolean;
  partnerId?: number | null;
  denominations?: Record<string, number>;
}

interface VendorPayment {
  id: number;
  total_paid: number;
  payment_method: PaymentMethod;
  created_at: string;
  created_by: string;
}

interface VendorSettlementResponse {
  message: string;
  settlement_id: number;
  total_due: number;
  total_paid: number;
  difference: number;
}

interface VendorSummary {
  id: number;
  name: string;
  total_due?: number;
  total_paid?: number;
  phone?: string;
}

export interface VendorExpense {
  id: number;
  amount: number;
  description?: string;
  created_at: string;
  category?: string;
}

export interface VendorSettlement {
  id: number;
  total_paid: number;
  payment_method: string;
  created_at: string;
}

// ================= GET VENDORS =================

export function useVendors() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: () => get<Vendor[]>("/vendors"),
    staleTime: 1000 * 30,
  });
}

// ================= SUMMARY =================

export function useVendorSummary() {
  return useQuery<VendorSummary[]>({
    queryKey: ["vendors-summary"],
    queryFn: () => get<VendorSummary[]>("/vendors/summary"),
    staleTime: 1000 * 30,
  });
}
// ================= BALANCE VIEW =================

export function useVendorBalances() {
  return useQuery({
    queryKey: ["vendors-balance"],
    queryFn: () => get("/vendors/with-balance"),
  });
}

// ================= CREATE =================

export function useCreateVendor() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vendor: { name: string; phone?: string }) => {
      const promise = post("/vendors", vendor);

      return toastPromise(promise, {
        loading: "Adding vendor...",
        success: "Vendor added",
        error: (err) => err?.message || "Failed to add vendor",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendors-summary"] });
    },
  });
}

// ================= DELETE (DEACTIVATE) =================

export function useDeleteVendor() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/vendors/${id}`);

      return toastPromise(promise, {
        loading: "Removing vendor...",
        success: "Vendor deactivated",
        error: "Delete failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendors-summary"] });
    },
  });
}

// ================= UNPAID =================

export function useVendorUnpaid(vendorId?: number) {
  return useQuery<VendorExpense[]>({
    queryKey: ["vendor-unpaid", vendorId],
    enabled: !!vendorId,
    queryFn: () => get<VendorExpense[]>(`/vendors/${vendorId}/unpaid`),
  });
}

// ================= SETTLEMENT =================

export function useSettleVendor(vendorId?: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: VendorSettlementPayload) => {
      if (!vendorId) throw new Error("Vendor ID missing");

      const promise = put<VendorSettlementResponse>(
        `/vendors/${vendorId}/settle`,
        payload
      );

      return toastPromise(promise, {
        loading: "Processing settlement...",
        success: (data) =>
          `Paid ${formatCurrency(data.total_paid)} • Remaining ${formatCurrency(data.difference)}`,
        error: (err) => err?.message || "Settlement failed",
      });
    },

    onSuccess: () => {
      // 🔥 CORE SYSTEM

      qc.invalidateQueries({ queryKey: ["vendors-summary"] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendors-balance"] });
      qc.invalidateQueries({ queryKey: ["vendor-unpaid"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });

      // 💰 CASH SYSTEM
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "current-cash",
      });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });

      // 🏦 BANK SYSTEM
      qc.invalidateQueries({ queryKey: ["bank-balance"] });
      qc.invalidateQueries({ queryKey: ["bank-history"] });

      // 📊 REPORTS (🔥 FIXED)
      qc.invalidateQueries({ queryKey: ["reports"] });
    },

    onError: () => {
      toastError("Unable to settle vendor");
    },
  });
}

// ================= SETTLEMENT HISTORY =================

export function useVendorSettlements(vendorId?: number) {
  return useQuery<VendorSettlement[]>({
    queryKey: ["vendor-settlements", vendorId],
    enabled: !!vendorId,
    queryFn: () => get<VendorSettlement[]>(`/vendors/${vendorId}/settlements`),
  });
}

// ================= PAYMENTS =================

export function useVendorPayments(vendorId?: number) {
  return useQuery({
    queryKey: ["vendor-payments", vendorId],
    enabled: !!vendorId,
    queryFn: () => get(`/vendors/${vendorId}/payments`),
  });
}

// ================= LEDGER =================

export function useVendorLedger(
  vendorId?: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ["vendor-ledger", vendorId],
    enabled: !!vendorId && enabled,
    queryFn: () => get(`/vendors/${vendorId}/ledger`),
  });
}