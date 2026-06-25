import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "@/lib/api";
import { toastPromise } from "@/hooks/use-toast";

// ================= TYPES =================

export interface Staff {
  id: number;
  name: string;
  weekly_hours?: number;
}

export interface Shift {
  id: number;
  date: string;
  shift_start: string;
  shift_end: string;
  base_rate?: number;
  pay_type_id?: number;
  staff: Staff[];
}

// ================= ROSTER =================

// ================= OVERVIEW TYPES =================

export interface StaffStatusEntry {
  id: number;
  name: string;
  status: "working" | "late" | "absent" | "upcoming" | "off";
  shift_start?: string;
  shift_end?: string;
  clocked_in_at?: string;
}

export interface StaffOverview {
  working: StaffStatusEntry[];
  late: StaffStatusEntry[];
  absent: StaffStatusEntry[];
  upcoming: StaffStatusEntry[];
}

export interface ShiftLog {
  id: number;
  staff_id: number;
  staff_name: string;
  shift_date: string;
  clocked_in_at: string;
  clocked_out_at?: string;
  actual_hours?: number;
}

export interface MyShift {
  id: number;
  shift_id: number;
  date: string;
  shift_start: string;
  shift_end: string;
}

// ================= ROSTER =================

export function useRoster(start?: string, end?: string) {
  return useQuery({
    queryKey: ["roster", start, end],
    enabled: !!start && !!end,

    queryFn: () =>
      get<Shift[]>("/roster", {
        params: { start, end },
      }),

    staleTime: 1000 * 30,
  });
}

// ================= CREATE SHIFT =================

export function useCreateShift() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      date: string;
      shift_start: string;
      shift_end: string;
      staff_ids: number[];
      base_rate?: number;
      pay_type_id?: number;
    }) => {
      const promise = post("/roster", data);

      return toastPromise(promise, {
        loading: "Creating shift...",
        success: "Shift created",
        error: (err: any) => err?.message || "Failed to create shift",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roster"] });
      qc.invalidateQueries({ queryKey: ["shift-analytics"] });
      qc.invalidateQueries({ queryKey: ["shift-logs"] });
    },

  });
}

// ================= UPDATE SHIFT =================

export function useUpdateShift() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const promise = put(`/roster/${id}`, data);

      return toastPromise(promise, {
        loading: "Updating shift...",
        success: "Shift updated",
        error: (err: any) => err?.message || "Update failed",
      });
    },

    onSuccess: (data: any) => {
      qc.setQueriesData<Shift[]>({ queryKey: ["roster"] }, (old) =>
        old ? old.map((s) => (s.id === data?.id ? { ...s, ...data } : s)) : old
      );
      qc.invalidateQueries({ queryKey: ["roster"] });
      qc.invalidateQueries({ queryKey: ["shift-analytics"] });
      qc.invalidateQueries({ queryKey: ["shift-logs"] });
    },
  });
}

// ================= DELETE SHIFT =================

export function useDeleteShift() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = del(`/roster/${id}`);

      return toastPromise(promise, {
        loading: "Deleting shift...",
        success: "Shift deleted",
        error: (err: any) => err?.message || "Delete failed",
      });
    },

    onSuccess: (_data, id) => {
      qc.setQueriesData<Shift[]>({ queryKey: ["roster"] }, (old) =>
        old ? old.filter((s) => s.id !== id) : old
      );
      qc.invalidateQueries({ queryKey: ["roster"] });
      qc.invalidateQueries({ queryKey: ["shift-analytics"] });
      qc.invalidateQueries({ queryKey: ["shift-logs"] });
    },
  });
}

// ================= COPY ROSTER =================

export function useCopyRoster() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: { from_date: string; to_date: string }) => {
      const promise = post("/roster/copy", data);

      return toastPromise(promise, {
        loading: "Copying roster...",
        success: "Roster copied",
        error: (err: any) => err?.message || "Failed to copy roster",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roster"] });
    },
  });
}

// ================= STAFF VIEW =================

export function useMyShifts() {
  return useQuery({
    queryKey: ["my-shifts"],
    queryFn: () => get<MyShift[]>("/roster/my-shifts"),
    staleTime: 1000 * 30,
  });
}

export interface MyClockStatus {
  clocked_in: boolean;
  log: {
    id: number;
    clock_in: string;
    clock_in_location_text: string | null;
    clock_in_place_id: string | null;
    shift_start: string;
    shift_end: string;
    date: string;
  } | null;
}

export function useMyStatus() {
  return useQuery<MyClockStatus>({
    queryKey: ["my-status"],
    queryFn: () => get<MyClockStatus>("/roster/my-status"),
    refetchInterval: 1000 * 30,
  });
}

// ================= CLOCK IN =================

export function useClockIn() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data?: {
      place_id?: string;
      location_text?: string;
    }) => {
      const promise = post("/roster/clock-in", data || {});

      return toastPromise(promise, {
        loading: "Clocking in...",
        success: "Clock-in successful",
        error: (err: any) => err?.message || "Clock-in failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roster"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["shift-logs"] });
    },

  });
}

// ================= CLOCK OUT =================

export function useClockOut() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data?: {
      place_id?: string;
      location_text?: string;
    }) => {
      const promise = post("/roster/clock-out", data || {});

      return toastPromise(promise, {
        loading: "Clocking out...",
        success: "Clock-out successful",
        error: (err: any) => err?.message || "Clock-out failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roster"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["shift-logs"] });
    },

  });
}

// ================= ADMIN OVERVIEW =================

export function useStaffOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: () => get<StaffOverview>("/roster/overview"),
    refetchInterval: 1000 * 20, // 🔥 live dashboard feel
  });
}

// ================= SHIFT LOGS =================

export function useShiftLogs(start?: string, end?: string) {
  return useQuery({
    queryKey: ["shift-logs", start, end],
    enabled: !!start && !!end,

    queryFn: () =>
      get<ShiftLog[]>("/roster/logs", {
        params: { start, end },
      }),
  });
}

// ================= ANALYTICS =================

export function useShiftAnalytics(
  start?: string,
  end?: string,
  mode: "actual" | "roster" = "roster"
) {
  return useQuery({
    queryKey: ["shift-analytics", start, end, mode],
    enabled: !!start && !!end,

    queryFn: () =>
      get("/roster/shifts", {
        params: { start, end, mode },
      }),
  });
}

// ================= PAY TYPES =================

export interface PayType {
  id: number;
  name: string;
  base_rate: number;
}

export function usePayTypes() {
  return useQuery({
    queryKey: ["pay-types"],
    queryFn: () => get<PayType[]>("/roster/pay-types"),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreatePayType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; base_rate: number }) => {
      const promise = post("/roster/pay-types", data);
      return toastPromise(promise, {
        loading: "Creating pay type...",
        success: "Pay type created",
        error: "Failed to create pay type",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pay-types"] }),
  });
}

export function useUpdatePayType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; base_rate: number }) => {
      const promise = put(`/roster/pay-types/${id}`, data);
      return toastPromise(promise, {
        loading: "Updating...",
        success: "Pay type updated",
        error: "Failed to update",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pay-types"] }),
  });
}

export function useDeletePayType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => {
      const promise = del(`/roster/pay-types/${id}`);
      return toastPromise(promise, {
        loading: "Deleting...",
        success: "Pay type deleted",
        error: "Failed to delete",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pay-types"] }),
  });
}

// ================= XERO =================

export function useSendToXero() {
  return useMutation({
    mutationFn: async (data: { shifts: any[] }) => {
      const promise = post("/roster/send-to-xero", data);

      return toastPromise(promise, {
        loading: "Processing payroll...",
        success: "Payroll batch created",
        error: "Payroll failed",
      });
    },

  });
}