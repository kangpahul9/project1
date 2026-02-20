import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export function useUnpaidOrders() {
  return useQuery({
    queryKey: ["unpaid-orders"],
    queryFn: async () => {
      const res = await api.get("/orders/unpaid");
      return res.data;
    },
  });
}

export function useMarkOrderPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payAmount,
      paymentMethod,
      cashBreakdown,
    }: {
      id: number;
      payAmount: number;
      paymentMethod: "cash" | "online" | "card";
      cashBreakdown?: any[];
    }) => {
      const res = await api.post(`/orders/${id}/pay`, {
        payAmount,
        paymentMethod,
        cashBreakdown,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unpaid-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/orders"] });
    },
  });
}

export function useOrderById(id?: string | null) {
  return useQuery({
    queryKey: ["order", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get(`/orders/${id}`);
      return res.data;
    },
  });
}
