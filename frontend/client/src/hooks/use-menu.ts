import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ===============================
   GET MENU ITEMS
================================ */
export function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: async () => {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/menu`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch menu");
      }

      const data = await res.json();

      return data.map((item: any) => ({
        ...item,
        price: Number(item.price),
      }));
    },
  });
}


/* ===============================
   CREATE MENU ITEM
================================ */
export function useCreateMenuItem() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/menu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to create menu item");
      }

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
queryClient.refetchQueries({ queryKey: ["menu"] });
    },
  });
}

/* ===============================
   UPDATE MENU ITEM
================================ */
export function useUpdateMenuItem() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: any) => {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/menu/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to update menu item");
      }

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
queryClient.refetchQueries({ queryKey: ["menu"] });
    },
  });
}

/* ===============================
   DELETE MENU ITEM
================================ */
export function useDeleteMenuItem() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/menu/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete menu item");
      }

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
queryClient.refetchQueries({ queryKey: ["menu"] });
    },
  });
}

/* ===============================
   GET MENU CATEGORIES
================================ */
export function useMenuCategories() {
  return useQuery({
    queryKey: ["menu-categories"],
    queryFn: async () => {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/menu/categories`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch categories");
      }

      return res.json();
    },
  });
}

/* ===============================
   CREATE CATEGORY
================================ */
export function useCreateCategory() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/menu/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to create category");
      }

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
    },
  });
}

/* ===============================
   UPDATE CATEGORY
================================ */
export function useUpdateCategory() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: any) => {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/menu/categories/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to update category");
      }

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
    },
  });
}

/* ===============================
   DELETE CATEGORY
================================ */
export function useDeleteCategory() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {

      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE}/menu/categories/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete category");
      }

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
    },
  });
}