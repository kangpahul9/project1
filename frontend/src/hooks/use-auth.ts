import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type LoginRequest } from "@shared/routes";
import { useLocation } from "wouter";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface AuthState {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'pos-auth-storage',
    }
  )
);

export function useLogin() {
  const { login } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid PIN code");
        throw new Error("Login failed");
      }
      return await res.json() as User;
    },
    onSuccess: (user) => {
      login(user);
      setLocation("/dashboard");
      toast({
        title: "Welcome back!",
        description: `Logged in as ${user.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Access Denied",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const [, setLocation] = useLocation();
  
  return () => {
    logout();
    setLocation("/login");
  };
}
