import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastSuccess, toastError, toastPromise } from "@/hooks/use-toast";

// ================= TYPES =================

export interface User {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  is_active: boolean;
}

// ================= GET USERS =================

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => get<User[]>("/users"),
    staleTime: 1000 * 30,
  });
}

// ================= CREATE USER =================

export function useCreateUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      email: string;
      password: string;
      role: "ADMIN" | "STAFF";
    }) => {
      const promise = post("/users", payload);

      return toastPromise(promise, {
        loading: "Creating user...",
        success: "User created",
        error: (err) => err?.message || "Failed to create user",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },

    onError: () => {
      toastError("Unable to create user");
    },
  });
}

// ================= UPDATE USER =================

export function useUpdateUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: number;
      name?: string;
      role?: "ADMIN" | "STAFF";
      is_active?: boolean;
    }) => {
      const promise = put(`/users/${id}`, payload);

      return toastPromise(promise, {
        loading: "Updating user...",
        success: "User updated",
        error: (err) => err?.message || "Update failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// ================= DELETE USER =================

export function useDeleteUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/users/${id}`);

      return toastPromise(promise, {
        loading: "Deleting user...",
        success: "User deleted",
        error: "Delete failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// ================= TOGGLE ACTIVE =================

export function useToggleUserStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: number;
      is_active: boolean;
    }) => {
      return put(`/users/${id}`, { is_active });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toastSuccess("User status updated");
    },

    onError: () => {
      toastError("Failed to update status");
    },
  });
}