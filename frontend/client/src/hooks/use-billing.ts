import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { withApiBase } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";

function getAuthHeaders() {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export function useCreateCheckout() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/billing/create-checkout`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({  }),
      });

      if (!res.ok) throw new Error("Checkout failed");

      return res.json();
    },

    onSuccess: (data) => {
      window.location.href = data.url;
    },

    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start payment",
        variant: "destructive",
      });
    },
  });
}