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
      queryClient.invalidateQueries({ queryKey: ["staff-balance"] });
      queryClient.invalidateQueries({ queryKey: ["staff-history"] });
  queryClient.invalidateQueries({ queryKey: ["staff-summary"] });
  queryClient.invalidateQueries({ queryKey: ["vendors-summary"] });
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

export function useUploadExpenseImage() {
  const { toast } = useToast();

  return async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/expenses/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    });

    if (!res.ok) {
      toast({
        title: "Upload Failed",
        variant: "destructive",
      });
      throw new Error("Upload failed");
    }

    const data = await res.json();
    return data.url;
  };
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...expense }: any) => {
      const res = await fetch(`${API_BASE}/expenses/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(expense),
      });

      const data = await res.json(); // ✅ always read

      if (!res.ok) {
        console.error("UPDATE ERROR:", data); // 🔥 IMPORTANT
        throw new Error(data.message || "Update failed");
      }

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["vendors-summary"] });
      toast({ title: "Expense updated" });
    },

    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Update failed",
        variant: "destructive",
      });
    },
  });
}
export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/expenses/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["vendors-summary"] });
      toast({ title: "Expense deleted" });
    },
  });
}