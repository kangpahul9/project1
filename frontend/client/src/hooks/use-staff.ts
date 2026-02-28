import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface Staff {
  id: number;
  name: string;
  role: string | null;
  phone: string | null;
  salary: number;
  is_active: boolean;
  balance: number;
}

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* ===============================
   GET STAFF
================================ */
export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/staff`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });
}

/* ===============================
   GET STAFF WITH BALANCE
================================ */
export function useStaffWithBalance() {
  return useQuery<Staff[]>({
    queryKey: ["staff-balance"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/staff/with-balance`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch balances");
      return res.json();
    },
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
  name: string;
  role?: string;
  phone?: string;
  salary?: number;
  opening_balance?: number;
}) => {
      const res = await fetch(`${API_BASE}/staff`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create staff");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-balance"] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: number;
      name: string;
      role?: string;
      phone?: string;
      salary?: number;
      is_active?: boolean;
    }) => {
      const res = await fetch(`${API_BASE}/staff/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to update staff");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-balance"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary"] });
    },
  });
}

export function useDeactivateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/staff/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to deactivate staff");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-balance"] });
      queryClient.invalidateQueries({ queryKey: ["staff-summary"] });
    },
  });
}


export function useStaffTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
  staffId,
  amount,
  type,
  reason,
  payment_method,
  deduct_from_galla,
  denominations,
  businessDayId,
}: any) => {
  const res = await fetch(`${API_BASE}/staff/${staffId}/transaction`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      amount,
      type,
      reason,
      payment_method,
      deduct_from_galla,
      denominations,
      businessDayId,
    }),
  });

  if (!res.ok) throw new Error("Transaction failed");
  return res.json();
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-balance"] });
    },
  });
}

/* ===============================
   STAFF SUMMARY
================================ */
export function useStaffSummary() {
  return useQuery({
    queryKey: ["staff-summary"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/staff/summary`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch staff summary");
      return res.json();
    },
  });
}

/* ===============================
   STAFF HISTORY
================================ */
export function useStaffHistory(staffId: number | null) {
  return useQuery({
    queryKey: ["staff-history", staffId],
    enabled: !!staffId,
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/staff/${staffId}/history`,
        { headers: getAuthHeaders() }
      );

      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });
}

export function useRoster(start: string, end: string) {
  return useQuery({
    queryKey: ["roster", start, end],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/staff/roster?start=${start}&end=${end}`,
        { headers: getAuthHeaders() }
      );

      if (!res.ok) throw new Error("Failed to fetch roster");
      return res.json();
    },
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_BASE}/staff/roster`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create shift");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`${API_BASE}/staff/roster/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to update shift");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/staff/roster/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Failed to delete shift");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
    },
  });
}