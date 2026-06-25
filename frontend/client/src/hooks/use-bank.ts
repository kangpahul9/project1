import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface BankBalance {
  balance: number;
}

export type BankSource =
  | "cash_transfer"
  | "bank_to_cash"
  | "owner_deposit"
  | "owner_withdraw";

export interface BankTransactionPayload {
  amount: number;
  type: "credit" | "debit";
  source: BankSource;
  description?: string;
  partnerId?: number | null;

  // 🔥 REQUIRED for cash flows
  denominations?: Record<number, number>;
}

export interface BankTransaction {
  id: number;
  amount: number;
  type: "credit" | "debit";
  source: BankSource;
  created_at: string;
  description?: string;
}

// ================= HELPERS =================

const generateIdempotencyKey = () =>
  `bank_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ================= QUERIES =================

export function useBankBalance() {
  return useQuery({
    queryKey: ["bank-balance"],
    queryFn: () => get<BankBalance>("/bank/balance"),
    staleTime: 1000 * 30,
  });
}

export function useBankHistory() {
  return useQuery({
    queryKey: ["bank-history"],
    queryFn: () => get<BankTransaction[]>("/bank/history"),
    staleTime: 1000 * 30,
  });
}

// ================= MUTATION =================

export function useBankTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BankTransactionPayload) => {
      const enrichedPayload = {
        ...payload,
        idempotencyKey: generateIdempotencyKey(),
      };

      const promise = post("/bank/transaction", enrichedPayload);

      return toastPromise(promise, {
        loading: "Processing transaction...",
        success:
          payload.type === "credit"
            ? "Money added to bank"
            : "Money withdrawn from bank",
        error: (err) => err?.message || "Transaction failed",
      });
    },

    onError: (err: any) => {
  toastError(err?.message || "Transaction failed");
},

    onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ["bank-balance"] });
  queryClient.invalidateQueries({ queryKey: ["bank-history"] });

  // 🔥 CASH SYSTEM
  queryClient.invalidateQueries({ queryKey: ["current-cash"] });
  queryClient.invalidateQueries({ queryKey: ["expected-cash"] });

  // 🔥 ANALYTICS
  queryClient.invalidateQueries({ queryKey: ["reports"] });
},
  });
}