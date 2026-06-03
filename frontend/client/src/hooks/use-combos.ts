import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface ComboTier {
  id?: number;
  quantity: number;
  price: number;
}

export interface ComboItem {
  id?: number;
  menu_item_id: number;
  menu_item_name?: string;
  item_price?: number;
  quantity: number;
}

export interface Combo {
  id: number;
  name: string;
  combo_type: "volume" | "bundle";
  bundle_price?: number | null;
  items: ComboItem[];
  tiers: ComboTier[];
}

interface ComboPayload {
  name: string;
  combo_type: "volume" | "bundle";
  bundle_price?: number | null;
  items: { menu_item_id: number; quantity: number }[];
  tiers?: ComboTier[];
}

// ================= QUERIES =================

export function useCombos() {
  return useQuery({
    queryKey: ["combos"],
    queryFn: () => get<Combo[]>("/combos"),
    staleTime: 1000 * 60,
  });
}

// ================= MUTATIONS =================

export function useCreateCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ComboPayload) =>
      toastPromise(post("/combos", payload), {
        loading: "Creating combo...",
        success: "Combo created",
        error: (err) => err?.message || "Failed to create combo",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combos"] }),
    onError: () => toastError("Unable to create combo"),
  });
}

export function useUpdateCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ComboPayload & { id: number }) =>
      toastPromise(put(`/combos/${id}`, payload), {
        loading: "Saving...",
        success: "Combo updated",
        error: (err) => err?.message || "Update failed",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combos"] }),
    onError: () => toastError("Unable to update combo"),
  });
}

export function useDeleteCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      toastPromise(del(`/combos/${id}`), {
        loading: "Removing...",
        success: "Combo removed",
        error: (err) => err?.message || "Delete failed",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combos"] }),
    onError: () => toastError("Unable to remove combo"),
  });
}

// ================= CART CALCULATOR =================

export function calcComboSavings(
  cart: { id: number; price: number; quantity: number }[],
  combos: Combo[]
): { savings: number; applied: { name: string; saving: number }[] } {
  let savings = 0;
  const applied: { name: string; saving: number }[] = [];

  for (const combo of combos) {
    // ── VOLUME: one item, multiple quantity-price tiers ──────────────────────
    if (combo.combo_type === "volume" && combo.items.length === 1) {
      const ci = combo.items[0];
      const cartItem = cart.find((i) => i.id === ci.menu_item_id);
      if (!cartItem || cartItem.quantity < 1) continue;

      const sorted = [...combo.tiers].sort((a, b) => b.quantity - a.quantity);
      for (const tier of sorted) {
        if (cartItem.quantity >= tier.quantity) {
          const groups = Math.floor(cartItem.quantity / tier.quantity);
          const normalCost = cartItem.price * tier.quantity * groups;
          const comboCost = tier.price * groups;
          const saving = normalCost - comboCost;
          if (saving > 0) {
            savings += saving;
            applied.push({ name: combo.name, saving });
          }
          break;
        }
      }
    }

    // ── BUNDLE: multiple items at a fixed total price ─────────────────────────
    if (combo.combo_type === "bundle" && combo.items.length > 1) {
      const allPresent = combo.items.every((ci) => {
        const cartItem = cart.find((i) => i.id === ci.menu_item_id);
        return cartItem && cartItem.quantity >= ci.quantity;
      });

      if (!allPresent) continue;

      const bundleCount = Math.min(
        ...combo.items.map((ci) => {
          const cartItem = cart.find((i) => i.id === ci.menu_item_id)!;
          return Math.floor(cartItem.quantity / ci.quantity);
        })
      );

      const normalCostPerSet = combo.items.reduce((sum, ci) => {
        const cartItem = cart.find((i) => i.id === ci.menu_item_id)!;
        return sum + cartItem.price * ci.quantity;
      }, 0);

      if (combo.tiers.length > 0) {
        // bundle with volume tiers — find best tier for number of sets
        const sorted = [...combo.tiers].sort((a, b) => b.quantity - a.quantity);
        for (const tier of sorted) {
          if (bundleCount >= tier.quantity) {
            const groups = Math.floor(bundleCount / tier.quantity);
            const normalCost = normalCostPerSet * tier.quantity * groups;
            const comboCost = tier.price * groups;
            const saving = normalCost - comboCost;
            if (saving > 0) {
              savings += saving;
              applied.push({ name: combo.name, saving });
            }
            break;
          }
        }
      } else if (combo.bundle_price) {
        // flat bundle price
        const normalCost = normalCostPerSet * bundleCount;
        const comboCost = combo.bundle_price * bundleCount;
        const saving = normalCost - comboCost;
        if (saving > 0) {
          savings += saving;
          applied.push({ name: combo.name, saving });
        }
      }
    }
  }

  return { savings, applied };
}
