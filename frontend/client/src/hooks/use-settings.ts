import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { withApiBase } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";

function getAuthHeaders() {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}


/* ================================
   SYSTEM SETTINGS
================================ */

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch(withApiBase("/settings"), {
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error("Failed to fetch settings");

      return res.json();
    }
  });
}


export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(withApiBase("/settings"), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to update settings");

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });

      toast({
        title: "Settings Updated"
      });
    }
  });
}


/* ================================
   COMMUNICATION SETTINGS
================================ */

export function useCommunicationSettings() {
  return useQuery({
    queryKey: ["communication-settings"],
    queryFn: async () => {
      const res = await fetch(withApiBase("/settings/communication"), {
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error("Failed to fetch communication settings");

      return res.json();
    }
  });
}


export function useUpdateCommunicationSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(withApiBase("/settings/communication"), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to update communication settings");

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["communication-settings"]
      });

      toast({
        title: "Communication Settings Updated"
      });
    }
  });
}

export function useBankAccount() {
  return useQuery({
    queryKey: ["bank-account"],
    queryFn: async () => {
      const res = await fetch(withApiBase("/settings/bank-account"), {
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error("Failed to fetch bank account");

      return res.json();
    }
  });
}

export function useUpsertBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(withApiBase("/settings/bank-account"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save bank account");

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-account"] });

      toast({
        title: "Bank Account Updated"
      });
    }
  });
}