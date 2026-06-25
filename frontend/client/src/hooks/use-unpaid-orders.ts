import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import type { OrderDetails } from "./use-orders";

// ================= TYPES =================

type PaymentMethod =
  | "cash"
  | "online"
  | "card"
  | "mixed-card"
  | "mixed-online"
  | "unpaid"; // 🔥 FIXED

interface PayOrderPayload {
  id: number;
  paymentMethod: PaymentMethod;
  cashBreakdown?: { note: number; qty: number }[];
  manualChangeBreakdown?: { note: number; qty: number }[];

  // 🔥 IMPORTANT (partial payments)
  amountPaid?: number;
}

interface PayOrderResponse {
  message?: string;
  changeBreakdown?: { note: number; qty: number }[];
}

// ================= TYPES =================

export interface UnpaidOrder {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  total: number;
  amount_paid: number;
  due_amount: number;
  created_at: string;
  bill_number?: string;
}

// ================= GET UNPAID =================

export function useUnpaidOrders() {
  return useQuery<UnpaidOrder[]>({
    queryKey: ["unpaid-orders"],
    queryFn: () => get<UnpaidOrder[]>("/orders/unpaid"),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

// ================= PAY ORDER =================

export function useMarkOrderPaid() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PayOrderPayload) => {
      const idempotencyKey = crypto.randomUUID();

      const promise = post<PayOrderResponse>(`/orders/${payload.id}/pay`, {
  paymentMethod: payload.paymentMethod,
  cashBreakdown: payload.cashBreakdown,
  manualChangeBreakdown: payload.manualChangeBreakdown,
  amountPaid: payload.amountPaid,
  idempotencyKey,
});

      const res = await promise;

      // 🔥 handle idempotency gracefully
      if (res?.message === "Already processed") {
        return res;
      }

      return res;
    },

    onSuccess: (data) => {
      if (data?.message === "Already processed") {
        toastError("This payment was already recorded");
        return;
      }
      // 🔥 show change if exists
      toastPromise(Promise.resolve(), {
        loading: "Processing payment...",
        success: data?.changeBreakdown?.length
          ? `Payment done • Change returned ${formatCurrency(data.changeBreakdown.reduce(
              (s: number, d: any) => s + d.note * d.qty,
              0
            ))}`
          : "Payment successful",
        error: "Payment failed",
      });

      // ================= INVALIDATIONS =================

      qc.invalidateQueries({ queryKey: ["unpaid-orders"] });
      qc.invalidateQueries({ queryKey: ["orders"] });

      // 💰 CASH SYSTEM
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "current-cash",
      });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });

      // 📊 REPORTS (FIXED KEYS)
      qc.invalidateQueries({ queryKey: ["reports"] });

      // 🏦 BANK
      qc.invalidateQueries({ queryKey: ["bank-balance"] });
      qc.invalidateQueries({ queryKey: ["bank-history"] });

      // 📉 CREDIT SYSTEM
      qc.invalidateQueries({ queryKey: ["vendors-summary"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to process payment");
    },
  });
}

// ================= ORDER DETAILS =================

export function useOrderById(id?: number | null) {
  return useQuery<OrderDetails>({
    queryKey: ["order", id],
    enabled: !!id,
    queryFn: () => get<OrderDetails>(`/orders/${id}`),
  });
}