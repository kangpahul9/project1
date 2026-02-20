import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export function useDailyReport(date?: string) {
  return useQuery({
    queryKey: ["daily-report", date],
    enabled: !!date,
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/reports/daily?date=${date}`,
        { headers: getAuthHeaders() }
      );

      if (!res.ok) throw new Error("Failed to fetch report");
      return await res.json();
    },
  });
}

export function useWeeklyReport() {
  return useQuery({
    queryKey: ["weekly-report"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/reports/weekly`, {
        headers: getAuthHeaders(),
      });
      return res.json();
    },
  });
}

export function useMonthlyReport() {
  return useQuery({
    queryKey: ["monthly-report"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/reports/monthly`, {
        headers: getAuthHeaders(),
      });
      return res.json();
    },
  });
}

export function useWeeklySummary() {
  return useQuery({
    queryKey: ["weekly-summary"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/reports/weekly-summary`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch weekly summary");
      return res.json();
    },
  });
}

export function useMonthlySummary() {
  return useQuery({
    queryKey: ["monthly-summary"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/reports/monthly-summary`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch monthly summary");
      return res.json();
    },
  });
}


