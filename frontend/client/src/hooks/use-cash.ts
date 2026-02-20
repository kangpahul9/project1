import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export function useCurrentCash(businessDayId?: number) {
  return useQuery({
    queryKey: ["current-cash", businessDayId],
    enabled: !!businessDayId,
    queryFn: async () => {
      const res = await api.get("/orders/cash/current", {
        params: { businessDayId },
      });
      return res.data;
    },
  });
}
