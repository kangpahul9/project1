import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export function useCurrentCash(businessDayId?: number) {
  return useQuery({
    queryKey: ["current-cash", businessDayId],
    enabled: true,
    queryFn: async () => {
      const res = await api.get("/orders/cash/current", {
        params: { businessDayId },
      });
      return res.data;
    },
  });
}


export function useRecountCash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post("/orders/cash/recount", data);
      return res.data;
    },

    onSuccess: () => {
queryClient.invalidateQueries({
  predicate: (query) =>
    query.queryKey[0] === "current-cash",
});    },
  });
}