import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export function usePartners() {
  return useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/partners`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch partners");

      return await res.json();
    },
  });
}

export function useCreatePartner() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_BASE}/partners`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create partner");

      return res.json();
    },

    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });
}

export function useUpdatePartner() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`${API_BASE}/partners/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to update partner");

      return res.json();
    },

    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });
}

export function useDeletePartner() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/partners/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to delete partner");

      return res.json();
    },

    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });
}
export function usePartnerLedger() {
  return useQuery({
    queryKey: ["partner-ledger"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/partners/ledger`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch partner ledger");

      return res.json();
    },
  });
}

export function usePartnerHistory(partnerId: number) {
  return useQuery({
    queryKey: ["partner-history", partnerId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/partners/${partnerId}/ledger`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch partner ledger");

      return res.json();
    },
    enabled: !!partnerId,
  });
}