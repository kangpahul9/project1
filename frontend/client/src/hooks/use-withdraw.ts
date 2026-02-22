import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* ===========================
   WITHDRAW CASH MUTATION
=========================== */
export function useWithdrawCash() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_BASE}/withdrawals`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Withdrawal failed");
      }

      return await res.json();
    },

    onSuccess: () => {
      toast({
        title: "Withdrawal Successful",
        className: "bg-green-600 text-white",
      });

      // Refresh drawer + history automatically
      queryClient.invalidateQueries({ queryKey: ["current-cash"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-history"] });
    },

    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/* ===========================
   WITHDRAWAL HISTORY QUERY
=========================== */
export function useWithdrawalHistory(
  filters?: {
    from?: string;
    to?: string;
    businessDayId?: number;
  }
) {
  return useQuery({
    queryKey: ["withdrawal-history", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters?.from) params.append("from", filters.from);
      if (filters?.to) params.append("to", filters.to);
      if (filters?.businessDayId)
        params.append("businessDayId", String(filters.businessDayId));

      const res = await fetch(
        `${API_BASE}/withdrawals/history?${params.toString()}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch withdrawal history");
      }

      return await res.json();
    },

    enabled: true,
  });
}

/* ===========================
   DEPOSIT CASH MUTATION
=========================== */
export function useDepositCash() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_BASE}/withdrawals/deposit`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Deposit failed");
      }

      return await res.json();
    },

    onSuccess: () => {
      toast({
        title: "Cash Added Successfully",
        className: "bg-green-600 text-white",
      });

      queryClient.invalidateQueries({ queryKey: ["current-cash"] });
      queryClient.invalidateQueries({ queryKey: ["deposit-history"] });
    },

    onError: (error: any) => {
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDepositHistory(filters?: {
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: ["deposit-history", filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters?.from) params.append("from", filters.from);
      if (filters?.to) params.append("to", filters.to);

      const res = await fetch(
        `${API_BASE}/withdrawals/deposits-history?${params.toString()}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch deposit history");
      }

      return await res.json();
    },
  });
}