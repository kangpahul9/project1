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

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/expenses`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch expenses");

      return await res.json();
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (expense: any) => {
      const res = await fetch(`${API_BASE}/expenses`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(expense),
      });

      if (!res.ok) throw new Error("Failed to create expense");

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({
        title: "Success",
        description: "Expense recorded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record expense",
        variant: "destructive",
      });
    },
  });
}