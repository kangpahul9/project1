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

/* ===========================
   GET ORDERS
=========================== */
export function useOrders() {
  return useQuery({
    queryKey: ["/orders"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/orders`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch orders");
      return await res.json();
    },
  });
}


/* ===========================
   CREATE ORDER
=========================== */
export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (order: any) => {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(order),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create order");
      }

      return await res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/orders"] });
    },

    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useOrderDetails(id?: number | null) {
  return useQuery({
    queryKey: ["order-details", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/orders/${id}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch order details");
      return await res.json();
    },
  });
}

/* ===========================
   GET ORDER BY BILL NUMBER
=========================== */
export function useOrderByBillNumber(billNumber?: string) {
  return useQuery({
    queryKey: ["order-bill", billNumber],
    enabled: !!billNumber,
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/orders/bill/${billNumber}`,
        { headers: getAuthHeaders() }
      );

      if (!res.ok) throw new Error("Failed to fetch order");
      return await res.json();
    },
  });
}


