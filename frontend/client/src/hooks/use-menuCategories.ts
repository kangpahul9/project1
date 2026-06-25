import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface MenuCategory {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

// ================= HELPERS =================

const generateIdempotencyKey = () =>
  `cat_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ================= GET =================

export function useMenuCategories() {
  return useQuery({
    queryKey: ["menu-categories"],

    queryFn: () => get<MenuCategory[]>("/menu/categories"),

    staleTime: 1000 * 60,
  });
}

// ================= CREATE =================

export function useCreateCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      color?: string;
      sort_order?: number;
    }) => {
      const promise = post("/menu/categories", {
        ...payload,
        idempotencyKey: generateIdempotencyKey(),
      });

      return toastPromise(promise, {
        loading: "Creating category...",
        success: "Category created",
        error: (err) => err?.message || "Failed to create category",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-categories"] });
    },

    onError: () => {
      toastError("Unable to create category");
    },
  });
}

// ================= UPDATE =================

export function useUpdateCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: number;
      name?: string;
      color?: string;
      sort_order?: number;
      is_active?: boolean;
    }) => {
      const promise = put(`/menu/categories/${id}`, payload);

      return toastPromise(promise, {
        loading: "Updating category...",
        success: "Category updated",
        error: (err) => err?.message || "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-categories"] });
    },

    onError: () => {
      toastError("Unable to update category");
    },
  });
}

// ================= DISABLE =================

export function useDisableCategory() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/menu/categories/${id}`);

      return toastPromise(promise, {
        loading: "Disabling category...",
        success: "Category disabled",
        error: (err) => err?.message || "Disable failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-categories"] });
      qc.invalidateQueries({ queryKey: ["menu"] }); // 🔥 IMPORTANT
    },

    onError: () => {
      toastError("Unable to disable category");
    },
  });
}