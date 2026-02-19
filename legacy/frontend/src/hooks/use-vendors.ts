import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertVendor } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useVendors() {
  return useQuery({
    queryKey: [api.vendors.list.path],
    queryFn: async () => {
      const res = await fetch(api.vendors.list.path);
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return api.vendors.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vendor: InsertVendor) => {
      const res = await fetch(api.vendors.create.path, {
        method: api.vendors.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendor),
      });
      if (!res.ok) throw new Error("Failed to create vendor");
      return api.vendors.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vendors.list.path] });
      toast({ title: "Success", description: "Vendor added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add vendor", variant: "destructive" });
    }
  });
}
