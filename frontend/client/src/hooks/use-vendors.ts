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

/* ===============================
   VENDOR SUMMARY
================================ */
export function useVendorSummary() {
  return useQuery({
    queryKey: ["vendors-summary"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/vendors/summary`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch vendor summary");
      return res.json();
    },
  });
}

/* ===============================
   CREATE VENDOR
================================ */
export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vendor: { name: string; phone?: string }) => {
      const res = await fetch(`${API_BASE}/vendors`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(vendor),
      });

      if (!res.ok) throw new Error("Failed to create vendor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors-summary"] });
      toast({ title: "Success", description: "Vendor added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add vendor", variant: "destructive" });
    },
  });
}

/* ===============================
   GET UNPAID EXPENSES
================================ */
export function useVendorUnpaid(vendorId?: number) {
  return useQuery({
    queryKey: ["vendor-unpaid", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/vendors/${vendorId}/unpaid`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch unpaid expenses");
      return res.json();
    },
  });
}

/* ===============================
   SETTLE VENDOR
================================ */
/* ===============================
   SETTLE VENDOR
================================ */
export function useSettleVendor(vendorId?: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
  expenseIds: number[];
  payment_method: "card" | "online" | "cash";
  final_amount: number;
  deduct_from_galla?: boolean;
  denominations?: { [key: number]: number };
}) => {
      if (!vendorId) throw new Error("Vendor ID missing");

      const res = await fetch(`${API_BASE}/vendors/${vendorId}/settle`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Settlement failed");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendors-summary"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-unpaid", vendorId] });

      toast({
        title: "Settlement Successful",
        description: `Paid ₹${data.total_paid}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Settlement failed",
        variant: "destructive",
      });
    },
  });
}

export function useVendorSettlements(vendorId?: number) {
  return useQuery({
    queryKey: ["vendor-settlements", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/vendors/${vendorId}/settlements`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch settlements");
      return res.json();
    },
  });
}