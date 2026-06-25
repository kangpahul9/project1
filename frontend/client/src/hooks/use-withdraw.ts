import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

// ================= TYPES =================

export type WithdrawalReason =
  | "Owner Personal"
  | "Supplier Payment"
  | "Bank Deposit"
  | "Petty Cash"
  | "Staff Salary"
  | "Utilities"
  | "Emergency Expense"
  | "Loan Repayment"
  | "Investment Transfer"
  | "Other";

interface Denomination {
  note: number;
  qty: number;
}

interface WithdrawalResponse {
  message: string;
  totalAmount: number;
}

interface DepositResponse {
  message: string;
  totalAmount: number;
}

interface WithdrawPayload {
  breakdown: Denomination[];
  reason: WithdrawalReason;
  description?: string;
  partnerId?: number | null;
}

interface DepositPayload {
  breakdown: Denomination[];
  reason?: string;
  partnerId?: number | null;
}

// ================= WITHDRAW =================

export function useWithdrawCash() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: WithdrawPayload) => {
      const promise = post<WithdrawalResponse>("/withdrawals", payload);

      return toastPromise(promise, {
        loading: "Processing withdrawal...",
        success: (data) => `${formatCurrency(data.totalAmount)} withdrawn`,
        error: (err) => err?.message || "Withdrawal failed",
      });
    },

    onSuccess: () => {
      // 💰 CASH SYSTEM
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "current-cash",
      });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });

      // 📊 REPORTS (🔥 FIXED)
      qc.invalidateQueries({ queryKey: ["reports"] });

      // 📉 EXPENSES (auto-created for some reasons)
      qc.invalidateQueries({ queryKey: ["expenses"] });

      // 👥 PARTNERS
      qc.invalidateQueries({ queryKey: ["partner-ledger"] });

      // 📜 HISTORY
      qc.invalidateQueries({ queryKey: ["withdrawal-history"] });

      // 🧾 BUSINESS DAY SUMMARY
      qc.invalidateQueries({ queryKey: ["business-day"] });
    },

    onError: () => {
      toastError("Unable to withdraw cash");
    },
  });
}

// ================= HISTORY TYPES =================

export interface CashFlowRecord {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
  owner_name?: string;
}

// ================= WITHDRAWAL HISTORY =================

export function useWithdrawalHistory(filters?: {
  from?: string;
  to?: string;
  reason?: string;
  partnerId?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery<CashFlowRecord[]>({
    queryKey: ["withdrawal-history", filters],

    queryFn: async () => {
      const res = await get<{ data: CashFlowRecord[] }>("/withdrawals/history", {
        params: filters,
      });
      return res.data;
    },

    staleTime: 1000 * 10,
  });
}

// ================= DEPOSIT =================

export function useDepositCash() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DepositPayload) => {
      const promise = post<DepositResponse>("/withdrawals/deposit", payload);

      return toastPromise(promise, {
        loading: "Adding cash...",
        success: (data) => `${formatCurrency(data.totalAmount)} added`,
        error: (err) => err?.message || "Deposit failed",
      });
    },

    onSuccess: () => {
      // 💰 CASH
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "current-cash",
      });

      qc.invalidateQueries({ queryKey: ["expected-cash"] });

      // 📊 REPORTS
      qc.invalidateQueries({ queryKey: ["reports"] });

      // 👥 PARTNERS
      qc.invalidateQueries({ queryKey: ["partner-ledger"] });

      // 📜 HISTORY
      qc.invalidateQueries({ queryKey: ["deposit-history"] });

      qc.invalidateQueries({ queryKey: ["business-day"] });
    },

    onError: () => {
      toastError("Unable to deposit cash");
    },
  });
}

// ================= DEPOSIT HISTORY =================

export function useDepositHistory(filters?: {
  from?: string;
  to?: string;
  partnerId?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery<CashFlowRecord[]>({
    queryKey: ["deposit-history", filters],

    queryFn: async () => {
      const res = await get<{ data: CashFlowRecord[] }>("/withdrawals/deposits-history", {
        params: filters,
      });
      return res.data;
    },

    staleTime: 1000 * 10,
  });
}