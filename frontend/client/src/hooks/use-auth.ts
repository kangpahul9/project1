import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { post } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";

// ================= TYPES =================

export interface User {
  id: number;
  name: string;
  role: "ADMIN" | "STAFF";
}

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  clear: () => void;
}

// ================= STORE =================

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clear: () => set({ user: null }),
    }),
    {
      name: "kangpos-auth",
    }
  )
);

// ================= LOGIN =================

interface LoginPayload {
  restaurantUid: string;
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  userId: number;
  name: string;
  role: "ADMIN" | "STAFF";
}

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (credentials: LoginPayload) => {
      // clear previous session
      localStorage.removeItem("token");

      const promise = post<LoginResponse>("/auth/login", credentials);

      return toastPromise(promise, {
        loading: "Signing in...",
        success: "Welcome back!",
        error: (err) => err?.message || "Invalid credentials",
      });
    },

    onSuccess: (data) => {
      // 🔐 store token
      localStorage.setItem("token", data.token);

      // 🧠 store user
      setUser({
        id: data.userId,
        name: data.name,
        role: data.role,
      });

      // 🚀 redirect
      setLocation("/dashboard");
    },

    onError: () => {
      toastError("Login failed");
    },
  });
}

// ================= LOGOUT =================

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const [, setLocation] = useLocation();

  return async () => {
    try {
      await post("/auth/logout");
    } catch {
      // swallow — token is cleared locally regardless
    }
    localStorage.removeItem("token");
    clear();
    setLocation("/login");
  };
}

// ================= HELPER =================

export function useAuth() {
  const user = useAuthStore((s) => s.user);

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === "ADMIN",
  };
}