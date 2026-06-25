import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface MenuItem {
  id: number;
  name: string;
  price: number;

  category_id: number | null;
  category_name?: string;
  category_color?: string;

  usage_count?: number;
  is_weight_based?: boolean;

  image_url?: string;
  is_active?: boolean;
  barcode?: string | null;
}

interface MenuPayload {
  name: string;
  price: number;

  category_id?: number;
  is_weight_based?: boolean;
  barcode?: string | null;
}

// ================= HELPERS =================

const generateIdempotencyKey = () =>
  `menu_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ================= GET MENU =================

export function useMenu() {
  return useQuery({
    queryKey: ["menu"],

    queryFn: async () => {
      const data = await get<MenuItem[]>("/menu");

      return data.map((item) => ({
        ...item,
        price: Number(item.price),
      }));
    },

    staleTime: 1000 * 60,
  });
}

// ================= CREATE =================

export function useCreateMenuItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MenuPayload) => {
      const promise = post("/menu", {
        ...payload,
        idempotencyKey: generateIdempotencyKey(),
      });

      return toastPromise(promise, {
        loading: "Creating item...",
        success: "Menu item created",
        error: (err) => err?.message || "Failed to create item",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
    },

    onError: () => {
      toastError("Unable to create menu item");
    },
  });
}

// ================= UPDATE =================

export function useUpdateMenuItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: MenuPayload & {
      id: number;
      is_active?: boolean;
    }) => {
      const promise = put(`/menu/${id}`, payload);

      return toastPromise(promise, {
        loading: "Updating item...",
        success: "Menu item updated",
        error: (err) => err?.message || "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
    },

    onError: () => {
      toastError("Unable to update item");
    },
  });
}

// ================= DELETE (DISABLE) =================

export function useDisableMenuItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/menu/${id}`);

      return toastPromise(promise, {
        loading: "Disabling item...",
        success: "Menu item disabled",
        error: (err) => err?.message || "Disable failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu"] });
    },

    onError: () => {
      toastError("Unable to disable item");
    },
  });
}

// ================= IMAGE UPLOAD =================

export function useUploadMenuImage() {
  return async (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/menu/${id}/image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      throw new Error("Upload failed");
    }

    const data = await res.json();
    return data;
  };
}

export function useDeleteMenuImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/menu/${id}/image`);
      return toastPromise(promise, {
        loading: "Removing image...",
        success: "Image removed",
        error: (err) => err?.message || "Remove failed",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
    onError: () => toastError("Unable to remove image"),
  });
}

export function useMenuItemByBarcode(barcode: string | null) {
  return useQuery({
    queryKey: ["menu-barcode", barcode],
    queryFn: () => get<MenuItem>(`/menu/barcode/${barcode}`),
    enabled: !!barcode,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}