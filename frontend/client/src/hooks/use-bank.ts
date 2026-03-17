import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { withApiBase } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";

function getAuthHeaders() {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export function useBankBalance() {
  return useQuery({
    queryKey: ["bank-balance"],
    queryFn: async () => {
      const res = await fetch(withApiBase("/bank/balance"), {
        headers: getAuthHeaders()
      });

      return res.json();
    }
  });
}

export function useBankTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(withApiBase("/bank/transaction"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Transaction failed");
      }

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-balance"] });

      toast({
        title: "Success",
        description: "Bank transaction completed"
      });
    },

    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  });
}

export function useBankHistory() {
  return useQuery({
    queryKey: ["bank-history"],
    queryFn: async () => {
      const res = await fetch(withApiBase("/bank/history"), {
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error("Failed to fetch history");

      return res.json();
    }
  });
}