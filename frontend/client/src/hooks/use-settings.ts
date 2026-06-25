import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface SystemSettings {
  use_business_day: boolean;
  enable_cash_recount: boolean;
  allow_staff_print: boolean;
  enable_vendor_ledger: boolean;
  enable_customer_ledger: boolean;
  enable_email: boolean;
  enable_partners: boolean;
  use_payroll?: boolean;

  currency_code?: "INR" | "AUD";
  payid?: string;
  payid_name?: string;

  eftpos_provider?: "tyro" | "linkly" | null;
  eftpos_api_key?: string | null;
  eftpos_merchant_id?: string | null;
  eftpos_terminal_id?: string | null;
}

export interface CommunicationSettings {
  send_bill_email: boolean;
  notify_owner_email: boolean;
  owner_email?: string;
}

export interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  ifsc?: string;
  account_holder: string;
}

export interface PaymentQR {
  qr: string;
  type: "UPI" | "PAYID";
  value: string;
}

// ================= SYSTEM SETTINGS =================

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => get<SystemSettings>("/settings"),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<SystemSettings>) => {
      const promise = put("/settings", payload);

      return toastPromise(promise, {
        loading: "Saving settings...",
        success: "Settings updated",
        error: (err) => err.message || "Update failed",
      });
    },

    onSuccess: () => {
      // 🔥 important: settings affect whole app
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["restaurant"] });
      qc.invalidateQueries({ queryKey: ["payment-qr"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to update settings");
    },
  });
}

// ================= COMMUNICATION =================

export function useCommunicationSettings() {
  return useQuery({
    queryKey: ["settings", "communication"],
    queryFn: () => get<CommunicationSettings>("/settings/communication"),
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateCommunicationSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<CommunicationSettings>) => {
      const promise = put("/settings/communication", payload);

      return toastPromise(promise, {
        loading: "Saving communication settings...",
        success: "Updated successfully",
        error: (err) => err.message || "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "communication"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to update communication settings");
    },
  });
}

// ================= BANK =================

export function useBankAccount() {
  return useQuery({
    queryKey: ["settings", "bank-account"],
    queryFn: () => get<BankAccount | null>("/settings/bank-account"),
    staleTime: 1000 * 60,
  });
}

export function useUpsertBankAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const promise = post("/settings/bank-account", payload);

      return toastPromise(promise, {
        loading: "Saving bank account...",
        success: "Bank account saved",
        error: (err) => err.message || "Failed to save",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "bank-account"] });
      qc.invalidateQueries({ queryKey: ["bank-balance"] });
      qc.invalidateQueries({ queryKey: ["bank-history"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to save bank account");
    },
  });
}

// ================= CURRENCY =================

export function useUpdateCurrency() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (currency_code: "INR" | "AUD") => {
      const promise = put("/settings/currency", { currency_code });

      return toastPromise(promise, {
        loading: "Updating currency...",
        success: "Currency updated",
        error: (err) => err.message || "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["settings", "payment-qr"] });
    },

    onError: (err: any) => {
      toastError(err.message || "Unable to update currency");
    },
  });
}

// ================= PAYMENT QR =================

export function usePaymentQR() {
  return useQuery({
    queryKey: ["settings", "payment-qr"],

    queryFn: () => get<PaymentQR>("/settings/payment-qr"),

    retry: false, // 🔥 backend returns 400 if not configured

    // 🔥 prevent UI spam
    staleTime: 1000 * 60,
  });
}