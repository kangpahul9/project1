import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, put } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface RestaurantInfo {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;

  logo_url?: string;

  currency: string;
  receipt_footer: string;

  created_at?: string;
  updated_at?: string;
}

export interface RestaurantSettings {
  use_business_day: boolean;
  enable_cash_recount: boolean;
  allow_staff_print: boolean;
  enable_vendor_ledger: boolean;
  enable_customer_ledger: boolean;
  enable_email: boolean;
  enable_partners: boolean;
}

// 🔥 SAFE DEFAULTS (match backend)
const DEFAULT_SETTINGS: RestaurantSettings = {
  use_business_day: true,
  enable_cash_recount: true,
  allow_staff_print: true,
  enable_vendor_ledger: true,
  enable_customer_ledger: true,
  enable_email: false,
  enable_partners: false,
};

// ================= GET INFO =================

export function useRestaurantInfo() {
  return useQuery({
    queryKey: ["restaurant", "info"],
    queryFn: () => get<RestaurantInfo>("/restaurant/info"),
    staleTime: 1000 * 60 * 5,
  });
}

// ================= GET SETTINGS =================

export function useRestaurantSettings() {
  return useQuery({
    queryKey: ["restaurant", "settings"],

    queryFn: async () => {
      const data = await get<Partial<RestaurantSettings>>(
        "/restaurant/settings"
      );

      // 🔥 fallback if backend returns {}
      return { ...DEFAULT_SETTINGS, ...data };
    },

    staleTime: 1000 * 60 * 5,
  });
}

// ================= UPDATE INFO =================

export function useUpdateRestaurantInfo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<RestaurantInfo>) => {
      // 🔥 map frontend → backend fields
      const payload = {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        logoUrl: data.logo_url,
        currency: data.currency,
        receiptFooter: data.receipt_footer,
      };

      const promise = put("/restaurant/info", payload);

      return toastPromise(promise, {
        loading: "Updating business...",
        success: "Business updated",
        error: "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", "info"] });
    },

    onError: () => {
      toastError("Unable to update restaurant");
    },
  });
}

// ================= UPDATE SETTINGS =================

export function useUpdateRestaurantSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<RestaurantSettings>) => {
      const promise = put("/restaurant/settings", data);

      return toastPromise(promise, {
        loading: "Saving settings...",
        success: "Settings updated",
        error: "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant", "settings"] });
    },

    onError: () => {
      toastError("Unable to update settings");
    },
  });
}

// ================= HELPER =================

export function useRestaurant() {
  const { data: info, isLoading: infoLoading } = useRestaurantInfo();
  const { data: settings, isLoading: settingsLoading } =
    useRestaurantSettings();

  const finalSettings = settings ?? DEFAULT_SETTINGS;

  return {
    info,
    settings: finalSettings,

    isLoading: infoLoading || settingsLoading,

    // 🔥 FEATURE FLAGS (KangPOS CORE)
    useBusinessDay: finalSettings.use_business_day,
    enableCashRecount: finalSettings.enable_cash_recount,
    enablePartners: finalSettings.enable_partners,
    enableEmail: finalSettings.enable_email,

    // 🔥 UI helpers
    currency: info?.currency || "₹",
    restaurantName: info?.name || "",
  };
}