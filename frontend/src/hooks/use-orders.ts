import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type CreateOrderRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useOrders(businessDayId?: number) {
  return useQuery({
    queryKey: [api.orders.list.path, businessDayId],
    enabled: !!businessDayId,
    queryFn: async () => {
      const url = `${api.orders.list.path}?businessDayId=${businessDayId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return api.orders.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (order: CreateOrderRequest) => {
      const res = await fetch(api.orders.create.path, {
        method: api.orders.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create order");
      }
      return api.orders.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
      // Don't show toast here as it might be intrusive during rapid POS usage, 
      // rely on UI feedback in the POS component instead
    },
    onError: (error) => {
      toast({
        title: "Order Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}
