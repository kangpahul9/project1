import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface Staff {
  id: number;
  name: string;
  role?: string | null;
  phone?: string | null;
  salary: number;
  joining_date: string;
  is_active: boolean;
  balance?: number;
  advance_total?: number;
  email?: string;
}

// 🔥 IMPORTANT (backend aligned)
interface StaffTransactionPayload {
  staffId: number;
  amount: number;
  type: "payment" | "adjustment";
  reason?: string;
  payment_method?: "cash" | "online" | "card";
  deduct_from_galla?: boolean;
  denominations?: Record<number, number>;
  businessDayId?: number;
  partnerId?: number | null;
}

// ================= GET STAFF =================

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: () => get<Staff[]>("/staff"),
    staleTime: 1000 * 60,
  });
}

export function useStaffWithBalance() {
  return useQuery({
    queryKey: ["staff", "balance"],
    queryFn: () => get<Staff[]>("/staff/with-balance"),
    staleTime: 1000 * 30,
  });
}

// ================= CREATE =================

export function useCreateStaff() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const promise = post("/staff", data);

      return toastPromise(promise, {
        loading: "Creating staff...",
        success: "Staff created",
        error: (err) => err.message || "Failed to create staff",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["staff", "balance"] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to create staff");
    },
  });
}

// ================= UPDATE =================

export function useUpdateStaff() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const promise = put(`/staff/${id}`, data);

      return toastPromise(promise, {
        loading: "Updating staff...",
        success: "Staff updated",
        error: (err) => err.message || "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["staff", "balance"] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to update staff");
    },
  });
}

// ================= DELETE =================

export function useDeleteStaff() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/staff/${id}`);

      return toastPromise(promise, {
        loading: "Removing staff...",
        success: "Staff removed",
        error: (err) => err.message || "Delete failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      qc.invalidateQueries({ queryKey: ["staff", "balance"] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to delete staff");
    },
  });
}

// ================= TRANSACTION =================

export function useStaffTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: StaffTransactionPayload) => {
      const promise = post(`/staff/${payload.staffId}/transaction`, payload);

      return toastPromise(promise, {
        loading: "Processing payment...",
        success: "Transaction completed",
        error: (err) => err.message || "Transaction failed",
      });
    },

    onSuccess: (_, vars) => {
      // 🔥 CRITICAL: sync ALL systems touched in backend
      qc.invalidateQueries({ queryKey: ["staff", "balance"] });
      qc.invalidateQueries({ queryKey: ["staff-history", vars.staffId] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });

      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["bank-balance"] });
      qc.invalidateQueries({ queryKey: ["bank-history"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Transaction failed");
    },
  });
}

// ================= SUMMARY =================

export interface StaffSummary {
  totalSalary: number;
  paidThisMonth: number;
  unpaidThisMonth: number;
  totalCredit: number;
  pendingAdvances: number;
}

export function useStaffSummary() {
  return useQuery<StaffSummary>({
    queryKey: ["staff-summary"],
    queryFn: () => get<StaffSummary>("/staff/summary"),
    staleTime: 1000 * 30,
  });
}

// ================= HISTORY =================

export interface StaffTransaction {
  id: number;
  amount: number;
  type: "payment" | "adjustment";
  reason?: string;
  payment_method?: string;
  created_at: string;
  expense_id?: number;
  linked_expense_id?: number;
}

export function useStaffHistory(staffId?: number) {
  return useQuery<StaffTransaction[]>({
    queryKey: ["staff-history", staffId],
    enabled: !!staffId,
    queryFn: () => get<StaffTransaction[]>(`/staff/${staffId}/history`),
  });
}

// ================= SELF =================

export function useMyStaffProfile() {
  return useQuery({
    queryKey: ["staff", "me"],
    queryFn: () => get("/staff/me"),
  });
}

export function useMyStaffHistory() {
  return useQuery({
    queryKey: ["staff", "me-history"],
    queryFn: () => get("/staff/me/history"),
  });
}

// ================= EARNINGS =================

export function useStaffEarnings(
  staffId?: number,
  start?: string,
  end?: string,
  mode: "actual" | "roster" = "actual"
) {
  return useQuery({
    queryKey: ["staff-earnings", staffId, start, end, mode],
    enabled: !!staffId && !!start && !!end,

    queryFn: () =>
      get(`/staff/${staffId}/earnings`, {
        params: { start, end, mode },
      }),
  });
}

// ================= ADVANCE HISTORY (AUD) =================

export interface StaffAdvance {
  id: number;
  amount: number;
  notes?: string | null;
  payroll_batch_id: number | null;
  created_at: string;
}

export function useStaffAdvanceHistory(staffId?: number) {
  return useQuery<StaffAdvance[]>({
    queryKey: ["staff-advance-history", staffId],
    enabled: !!staffId,
    queryFn: () => get<StaffAdvance[]>(`/staff/${staffId}/advance-history`),
  });
}

// ================= LOGIN UPDATE =================

export function useUpdateStaffLogin() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const promise = put(`/staff/${id}/login`, data);

      return toastPromise(promise, {
        loading: "Updating login...",
        success: "Login updated",
        error: (err) => err.message || "Failed to update login",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to update login");
    },
  });
}