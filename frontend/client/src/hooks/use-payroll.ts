import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise, toastSuccess, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface PayrollEntry {
  shift_id: number;
  staff_id: number;
  staff_name: string;
  date: string;
  shift_start: string;
  shift_end: string;
  day_type: "weekday" | "weekend";
  roster_hours: number;
  actual_hours: number;
  hours: number;
  pay_type_id?: number;
  pay_type_name: string;
  rate: number;
  gross_amount: number;
  paid_amount: number;
  remaining: number;
  outstanding_advance: number;
  clocked_in: boolean;
}

export interface Advance {
  id: number;
  staff_id: number;
  staff_name: string;
  amount: number;
  notes?: string;
  created_at: string;
  net_outstanding: number;
}

export interface PayrollBatch {
  id: number;
  status: string;
  payment_method: string;
  notes?: string;
  created_at: string;
  entry_count: number;
  total_amount: number;
}

// ================= PAYROLL SUMMARY =================

export function usePayrollSummary(
  start?: string,
  end?: string,
  mode: "roster" | "actual" = "roster"
) {
  return useQuery({
    queryKey: ["payroll", start, end, mode],
    enabled: !!start && !!end,
    queryFn: () =>
      get<PayrollEntry[]>("/payroll", { params: { start, end, mode } }),
    staleTime: 1000 * 30,
  });
}

// ================= RECORD PAYMENT =================

export function useRecordPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      entries: { shift_id: number; staff_id: number; hours: number; rate: number; amount: number }[];
      payment_method: "paid" | "xero";
      notes?: string;
      advance_deductions?: Record<number, number>;
    }) => {
      const promise = post("/payroll/pay", data);
      return toastPromise(promise, {
        loading: "Recording payment...",
        success: (d: any) => d?.message || "Payment recorded",
        error: (err: any) => err?.message || "Payment failed",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["payroll-batches"] });
      qc.invalidateQueries({ queryKey: ["advances"] });
      qc.invalidateQueries({ queryKey: ["staff", "balance"] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });
      qc.invalidateQueries({ queryKey: ["staff-advance-history"] });
    },
  });
}

// ================= PAYROLL BATCHES =================

export function usePayrollBatches() {
  return useQuery({
    queryKey: ["payroll-batches"],
    queryFn: () => get<PayrollBatch[]>("/payroll/batches"),
    staleTime: 1000 * 60,
  });
}

// ================= ADVANCES =================

export function useAdvances(staffId?: number) {
  return useQuery({
    queryKey: ["advances", staffId],
    queryFn: () =>
      get<Advance[]>("/payroll/advances", staffId ? { params: { staff_id: staffId } } : undefined),
    staleTime: 1000 * 60,
  });
}

export function useCreateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      staff_id: number;
      amount: number;
      notes?: string;
      deduct_from_galla?: boolean;
      denominations?: Record<string, number>;
    }) => {
      const promise = post("/payroll/advances", data);
      return toastPromise(promise, {
        loading: "Recording advance...",
        success: "Advance recorded",
        error: (err: any) => err?.message || "Failed to record advance",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advances"] });
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
    },
  });
}

export function useDeleteAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => {
      const promise = del(`/payroll/advances/${id}`);
      return toastPromise(promise, {
        loading: "Cancelling advance...",
        success: "Advance cancelled",
        error: (err: any) => err?.message || "Failed to cancel",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advances"] });
      qc.invalidateQueries({ queryKey: ["payroll"] });
    },
  });
}

// ================= UPDATE PAY TYPE RATES =================

export function useUpdatePayTypeRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...rates }: { id: number; weekday_rate?: number; weekend_rate?: number; holiday_rate?: number }) => {
      const promise = put(`/payroll/pay-types/${id}/rates`, rates);
      return toastPromise(promise, {
        loading: "Saving rates...",
        success: "Rates updated",
        error: (err: any) => err?.message || "Failed to save",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pay-types"] }),
  });
}
