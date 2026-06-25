import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

// ================= TYPES =================

interface Denomination {
  note: number;
  qty: number;
}

export interface BusinessDay {
  id: number;
  date: string;
  opening_cash: number;
  is_closed: boolean;
}

export interface ExpectedCash {
  businessDayId: number;
  expectedCash: number;
}

export interface CloseDayResponse {
  message: string;
  expectedCash: number;
  difference: number;
  cashSales: number;
  upiSales: number;
  expenses: number;
}

// ================= CURRENT DAY =================

export function useCurrentBusinessDay(useBusinessDay: boolean) {
  return useQuery({
    queryKey: ["business-day", "current"],
    enabled: !!useBusinessDay,

    queryFn: async () => {
      try {
        return await get<BusinessDay>("/business-days/current");
      } catch (err: any) {
        // 🔥 handle 204 gracefully
        if (err?.response?.status === 204) return null;
        throw err;
      }
    },

    staleTime: 1000 * 30,
  });
}

// ================= OPEN DAY =================

export function useOpenBusinessDay() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (denominations: Denomination[]) => {
      const promise = post("/business-days/start", { denominations });

      return toastPromise(promise, {
        loading: "Opening business day...",
        success: "Business day started",
        error: (err) => err?.message || "Failed to open business day",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-day"] });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });

      // 🔥 important sync
      qc.invalidateQueries({ queryKey: ["current-cash"] });
    },

    onError: () => {
      toastError("Unable to start business day");
    },
  });
}

// ================= CLOSE DAY =================

export function useCloseBusinessDay() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      breakdown: Denomination[];
      total: number;
      reason?: string | null;
    }) => {
      const promise = post<CloseDayResponse>("/business-days/close", data);

      return toastPromise(promise, {
        loading: "Closing business day...",
        success: (res) =>
          res.difference !== 0
            ? `Closed with ${formatCurrency(res.difference)} discrepancy`
            : "Business day closed successfully",
        error: (err) => err?.message || "Failed to close business day",
      });
    },

    onSuccess: () => {
      // 🔥 FULL SYSTEM RESET
      qc.invalidateQueries({ queryKey: ["business-day"] });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });

      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["reports"] });

      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["withdrawal-history"] });
      qc.invalidateQueries({ queryKey: ["deposit-history"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },

    onError: () => {
      toastError("Unable to close business day");
    },
  });
}

// ================= EXPECTED CASH =================

export function useExpectedCash(useBusinessDay: boolean) {
  return useQuery({
    queryKey: ["expected-cash"],
    enabled: !!useBusinessDay,

    queryFn: () => get<ExpectedCash>("/business-days/expected-cash"),

    staleTime: 1000 * 15,
  });
}