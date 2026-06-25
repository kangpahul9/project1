import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

interface Expense {
  id: number;
  amount: number;
  category: string;
  payment_method: "cash" | "online" | "card";
  is_paid: boolean;
  created_at: string;
}

interface ExpensePayload {
  amount: number;
  category: string;

  // 🔥 FIXED naming
  paymentMode: "cash" | "online" | "card";

  vendorId?: number;
  staff_id?: number;
  description?: string;

  is_paid?: boolean;
  deduct_from_galla?: boolean;

  denominations?: Record<number, number>; // 🔥 backend format
  partnerId?: number | null;

  date?: string;
  businessDayId?: number;
}

// ================= HELPERS =================

const generateIdempotencyKey = () =>
  `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ================= GET EXPENSES =================

export function useExpenses(useBusinessDay: boolean, businessDayId?: number) {
  return useQuery({
    queryKey: ["expenses", useBusinessDay, businessDayId],

    enabled: useBusinessDay ? !!businessDayId : true,

    queryFn: () =>
      get<Expense[]>("/expenses", {
        params: useBusinessDay ? { businessDayId } : {},
      }),

    staleTime: 1000 * 30,
  });
}

// ================= CREATE =================

export function useCreateExpense(useBusinessDay: boolean) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (expense: ExpensePayload) => {
      // 🔥 VALIDATION (frontend safety)
      if (expense.category === "supplies" && !expense.vendorId) {
        throw new Error("Vendor required for supplies");
      }

      if (expense.category === "salary" && !expense.staff_id) {
        throw new Error("Staff required for salary");
      }

      const payload = {
        ...expense,
        businessDayId: useBusinessDay ? expense.businessDayId : undefined,
        idempotencyKey: generateIdempotencyKey(),
      };

      const promise = post("/expenses", payload);

      return toastPromise(promise, {
        loading: "Recording expense...",
        success: "Expense recorded",
        error: (err) => err?.message || "Failed to record expense",
      });
    },

    onSuccess: () => {
      // 🔥 FULL SYSTEM SYNC
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });
      qc.invalidateQueries({ queryKey: ["vendors-summary"] });
      qc.invalidateQueries({ queryKey: ["staff-summary"] });
      qc.invalidateQueries({ queryKey: ["bank-balance"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["business-day"] });
    },

    onError: () => {
      toastError("Unable to record expense");
    },
  });
}

// ================= UPDATE =================

export function useUpdateExpense(useBusinessDay: boolean) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...expense
    }: ExpensePayload & { id: number }) => {
      const payload = {
        ...expense,
        businessDayId: useBusinessDay ? expense.businessDayId : undefined,
        idempotencyKey: generateIdempotencyKey(),
      };

      const promise = put(`/expenses/${id}`, payload);

      return toastPromise(promise, {
        loading: "Updating expense...",
        success: "Expense updated",
        error: (err) => err?.message || "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["vendors-summary"] });
      qc.invalidateQueries({ queryKey: ["bank-balance"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },

    onError: () => {
      toastError("Unable to update expense");
    },
  });
}

// ================= DELETE =================

export function useDeleteExpense() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/expenses/${id}`);

      return toastPromise(promise, {
        loading: "Deleting expense...",
        success: "Expense deleted",
        error: (err) => err?.message || "Delete failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["vendors-summary"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },

    onError: () => {
      toastError("Unable to delete expense");
    },
  });
}

// ================= UPLOAD =================

export function useUploadExpenseImage() {
  return async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/expenses/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      throw new Error("Upload failed");
    }

    const data = await res.json();
    return data.url;
  };
}