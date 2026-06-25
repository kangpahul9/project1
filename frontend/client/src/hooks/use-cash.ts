import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

// ================= TYPES =================

interface CashBreakdown {
  note_value: number;
  quantity: number;
}

interface CurrentCash {
  total: number;
  breakdown: CashBreakdown[];
}

interface RecountPayload {
  breakdown: {
    note: number;
    qty: number;
  }[];
}

// ================= HELPERS =================

const generateIdempotencyKey = () =>
  `recount_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ================= CURRENT CASH =================

export function useCurrentCash(
  useBusinessDay: boolean,
  businessDayId?: number
) {
  return useQuery({
    queryKey: ["current-cash", businessDayId],

    // 🔥 MUST require business day
    enabled: !!useBusinessDay && !!businessDayId,

    queryFn: () =>
      get<CurrentCash>("/orders/cash/current", {
        params: { businessDayId },
      }),

    staleTime: 1000 * 10,
    refetchOnWindowFocus: true,
  });
}

// ================= RECOUNT CASH =================

export function useRecountCash() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: RecountPayload) => {
      const payload = {
        ...data,
        idempotencyKey: generateIdempotencyKey(),
      };

      const promise = post("/orders/cash/recount", payload);

      return toastPromise(promise, {
        loading: "Recounting cash...",
        success: (res) => `Drawer updated → ${formatCurrency(res.total)}`,
        error: (err) => err?.message || "Recount failed",
      });
    },

    onSuccess: () => {
      // 🔥 full sync (critical)
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "current-cash",
      });

      qc.invalidateQueries({ queryKey: ["expected-cash"] });
      qc.invalidateQueries({ queryKey: ["business-day"] });

      // 🔥 IMPORTANT: affects reports + ledger indirectly
      qc.invalidateQueries({ queryKey: ["reports"] });
    },

    onError: () => {
      toastError("Unable to recount cash");
    },
  });
}