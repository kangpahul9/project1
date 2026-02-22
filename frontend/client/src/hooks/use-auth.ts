import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useToast } from "@/hooks/use-toast";



interface User {
  id: number;
  name: string;
  role: string;
}

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
      name: "pos-auth-storage",
    }
  )
);

export function useLogin() {
  const { login } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (credentials: { pin: string }) => {
      const API = import.meta.env.VITE_API_URL;
console.log("API URL:", import.meta.env.VITE_API_URL);
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid PIN code");
        throw new Error("Login failed");
      }

      const data = await res.json();

      // Store JWT
      localStorage.setItem("token", data.token);

      // Return user in correct shape
      return {
        id: data.userId,
        name: data.name,
        role: data.role,
      };
    },

    onSuccess: (user) => {
      login(user);                // Save to Zustand
      setLocation("/dashboard");  // Redirect
      toast({
        title: "Welcome back!",
        description: `Logged in as ${user.name}`,
      });
    },

    onError: (error: any) => {
      toast({
        title: "Access Denied",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const [, setLocation] = useLocation();

  return () => {
    localStorage.removeItem("token");
    logout();
    setLocation("/login");
  };
}
