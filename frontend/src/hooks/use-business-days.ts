import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useCurrentBusinessDay() {
  return useQuery({
    queryKey: [api.businessDays.getCurrent.path],
    queryFn: async () => {
      const res = await fetch(api.businessDays.getCurrent.path);
      if (res.status === 204) return null;
      if (!res.ok) throw new Error("Failed to fetch current day");
      return api.businessDays.getCurrent.responses[200].parse(await res.json());
    },
  });
}

export function useOpenBusinessDay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { openingCash: number; openedBy: number }) => {
      const res = await fetch(api.businessDays.open.path, {
        method: api.businessDays.open.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to open day");
      }
      return api.businessDays.open.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businessDays.getCurrent.path] });
      toast({ title: "Day Opened", description: "Business day started successfully." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
}

export function useCloseBusinessDay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; closingCash: number; closedBy: number }) => {
      const url = buildUrl(api.businessDays.close.path, { id });
      const res = await fetch(url, {
        method: api.businessDays.close.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to close day");
      return api.businessDays.close.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.businessDays.getCurrent.path] });
      toast({ title: "Day Closed", description: "Business day closed successfully." });
    },
  });
}
