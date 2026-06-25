import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

interface CheckoutResponse {
  url: string;
}

export interface Subscription {
  subscription_status: "active" | "inactive" | "trialing" | "past_due";
  subscription_valid_till: string | null;
}

// ================= CREATE CHECKOUT =================

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async () => {
      const promise = post<CheckoutResponse>("/billing/create-checkout", {});

      return toastPromise(promise, {
        loading: "Redirecting to payment...",
        success: "Opening checkout...",
        error: (err) => err?.message || "Failed to start payment",
      });
    },

    onSuccess: (data) => {
      // 🔥 slight delay so user actually sees toast
      setTimeout(() => {
        window.location.href = data.url;
      }, 500);
    },

    onError: () => {
      toastError("Unable to initiate payment");
    },
  });
}

// ================= SUBSCRIPTION =================

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => get<Subscription>("/billing/subscription"),

    staleTime: 1000 * 60,
    retry: 1,
  });
}