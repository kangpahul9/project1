import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* =============================
   GET CURRENT BUSINESS DAY
============================= */
export function useCurrentBusinessDay() {
  return useQuery({
    queryKey: ["/business-days/current"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/business-days/current`, {
        headers: getAuthHeaders(),
      });

      if (res.status === 204) return null;
      if (!res.ok) throw new Error("Failed to fetch current business day");

      return await res.json();
    },
  });
}

/* =============================
   OPEN BUSINESS DAY
============================= */
export function useOpenBusinessDay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (denominations: { note: number; qty: number }[]) => {
  const res = await fetch(`${API_BASE}/business-days/start`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ denominations }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message);
  }

  return await res.json();
},

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/business-days/current"] });
      toast({
        title: "Business Day Opened",
        description: "Day started successfully.",
      });
    },

    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

/* =============================
   CLOSE BUSINESS DAY
============================= */
export function useCloseBusinessDay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      breakdown: { note: number; qty: number }[];
      total: number;
      reason?: string | null;
    }) => {
      const res = await fetch(`${API_BASE}/business-days/close`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to close business day");
      }

      return await res.json();
    },

    onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["/business-days/current"] });
  queryClient.invalidateQueries({ queryKey: ["/business-days/expected-cash"] });

  toast({
    title: "Business Day Closed",
    description: "Day closed successfully.",
  });
},
  });
}

export function useExpectedCash() {
  return useQuery({
    queryKey: ["/business-days/expected-cash"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/business-days/expected-cash`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch expected cash");

      return await res.json();
    },
  });
}