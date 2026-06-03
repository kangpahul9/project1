import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface Partner {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  share_percent: number;
}

interface PartnerPayload {
  name: string;
  phone?: string;
  email?: string;
  share_percent: number;
}

// 🔥 CORRECT LEDGER TYPE
interface PartnerLedgerSummary {
  total_sales: number;
  total_expenses: number;
  total_profit: number;

  partners: {
    id: number;
    name: string;
    share_percent: number;

    deposits: number;
    withdrawals: number;
    expenses_paid: number;

    profit_share: number;
    net_balance: number;
  }[];
}

interface PartnerLedgerEntry {
  id: number;
  event_type: string;
  amount: number;
  created_at: string;
  metadata?: any;
  partner_name?: string;
}

// ================= HELPERS =================

const generateIdempotencyKey = () =>
  `partner_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ================= PARTNERS =================

export function usePartners() {
  return useQuery({
    queryKey: ["partners"],
    queryFn: () => get<Partner[]>("/partners"),
    staleTime: 1000 * 60,
  });
}

// ================= CREATE =================

export function useCreatePartner() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: PartnerPayload) => {
      if (data.share_percent < 0 || data.share_percent > 100) {
        throw new Error("Share % must be between 0–100");
      }

      const promise = post("/partners", {
        ...data,
        idempotencyKey: generateIdempotencyKey(), // 🔥 REQUIRED
      });

      return toastPromise(promise, {
        loading: "Creating partner...",
        success: "Partner created",
        error: (err) => err?.message || "Failed to create partner",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partner-ledger"] }); // 🔥
    },

    onError: () => {
      toastError("Unable to create partner");
    },
  });
}

// ================= UPDATE =================

export function useUpdatePartner() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: PartnerPayload & { id: number }) => {
      if (data.share_percent < 0 || data.share_percent > 100) {
        throw new Error("Share % must be between 0–100");
      }

      const promise = put(`/partners/${id}`, data);

      return toastPromise(promise, {
        loading: "Updating partner...",
        success: "Partner updated",
        error: (err) => err?.message || "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partner-ledger"] });
    },

    onError: () => {
      toastError("Unable to update partner");
    },
  });
}

// ================= DELETE =================

export function useDeletePartner() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/partners/${id}`);

      return toastPromise(promise, {
        loading: "Deleting partner...",
        success: "Partner deleted",
        error: (err) => err?.message || "Delete failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partner-ledger"] });
    },

    onError: () => {
      toastError("Unable to delete partner");
    },
  });
}

// ================= LEDGER SUMMARY =================

export function usePartnerLedger() {
  return useQuery({
    queryKey: ["partner-ledger"],
    queryFn: () => get<PartnerLedgerSummary>("/partners/ledger"),
    staleTime: 1000 * 30,
  });
}

// ================= INDIVIDUAL HISTORY =================

export function usePartnerHistory(partnerId?: number) {
  return useQuery({
    queryKey: ["partner-history", partnerId],
    enabled: !!partnerId,

    queryFn: () =>
      get<PartnerLedgerEntry[]>(`/partners/${partnerId}/ledger`),

    staleTime: 1000 * 30,
  });
}