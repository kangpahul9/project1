import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, put, post, del } from "@/lib/api";
import { toastPromise, toastError, toastSuccess } from "@/hooks/use-toast";

export interface XeroStatus {
  connected: boolean;
  tenant_name?: string;
  connected_at?: string;
  expires_at?: string;
}

export interface XeroEmployee {
  EmployeeID: string;
  FirstName: string;
  LastName: string;
  Status: string;
}

export interface XeroEarningsRate {
  EarningsRateID: string;
  Name: string;
  EarningsType: string;
  RateType: string;
  RatePerUnit?: number;
}

// ── Status ────────────────────────────────────────────────────────────────────

export function useXeroStatus() {
  return useQuery({
    queryKey: ["xero-status"],
    queryFn: () => get<XeroStatus>("/xero/status"),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

// ── Connect ───────────────────────────────────────────────────────────────────

export function useXeroConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await get<{ url: string }>("/xero/connect");

      return new Promise<void>((resolve, reject) => {
        const popup = window.open(data.url, "xero-oauth", "width=620,height=720,left=200,top=100");
        if (!popup) {
          reject(new Error("Popup blocked — allow popups for this site and try again"));
          return;
        }

        const handler = (e: MessageEvent) => {
          if (e.data?.xero === "connected") {
            window.removeEventListener("message", handler);
            resolve();
          } else if (e.data?.xero === "error") {
            window.removeEventListener("message", handler);
            reject(new Error(e.data.message || "Xero connection failed"));
          }
        };
        window.addEventListener("message", handler);

        // Fallback: if popup is closed without postMessage (e.g. user cancelled)
        const poll = setInterval(() => {
          if (popup.closed) {
            clearInterval(poll);
            window.removeEventListener("message", handler);
            // Don't reject — user may have completed; just re-check status
            resolve();
          }
        }, 500);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xero-status"] });
      toastSuccess("Connected to Xero!");
    },
    onError: (err: any) => toastError(err.message || "Failed to connect to Xero"),
  });
}

// ── Disconnect ────────────────────────────────────────────────────────────────

export function useXeroDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del("/xero/disconnect"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xero-status"] });
      toastSuccess("Disconnected from Xero");
    },
    onError: (err: any) => toastError(err.message || "Failed to disconnect"),
  });
}

// ── Employees ─────────────────────────────────────────────────────────────────

export interface XeroMappedEmployee {
  id: string;
  name: string;
}

export interface XeroMappedRate {
  id: string;
  name: string;
}

export function useXeroEmployees(enabled = true) {
  return useQuery({
    queryKey: ["xero-employees"],
    queryFn: () => get<XeroMappedEmployee[]>("/xero/employees"),
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

// ── Earnings Rates ────────────────────────────────────────────────────────────

export function useXeroEarningsRates(enabled = true) {
  return useQuery({
    queryKey: ["xero-earnings-rates"],
    queryFn: () => get<XeroMappedRate[]>("/xero/earnings-rates"),
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

// ── Map staff → Xero employee ─────────────────────────────────────────────────

export function useMapStaffToXero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, xeroEmployeeId }: { staffId: number; xeroEmployeeId: string }) =>
      put(`/xero/staff/${staffId}/employee`, { xero_employee_id: xeroEmployeeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toastSuccess("Staff mapped to Xero employee");
    },
    onError: (err: any) => toastError(err.message || "Failed to map staff"),
  });
}

// ── Map pay type → Xero earnings rate ────────────────────────────────────────

export function useMapPayTypeToXero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payTypeId, xeroRateId }: { payTypeId: number; xeroRateId: string }) =>
      put(`/xero/pay-types/${payTypeId}/earnings-rate`, { xero_earnings_rate_id: xeroRateId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pay-types"] });
      toastSuccess("Pay type mapped to Xero earnings rate");
    },
    onError: (err: any) => toastError(err.message || "Failed to map pay type"),
  });
}

// ── Setup employees (assign pay run calendar) ─────────────────────────────

export function useXeroSetupEmployees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const promise = post<{ message: string; calendar: string; results: Array<{ name: string; ok: boolean; error?: string }> }>(
        "/xero/setup-employees", {}
      );
      return toastPromise(promise, {
        loading: "Setting up Xero employees…",
        success: (d) => d.message,
        error: (err) => err.message || "Setup failed",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xero-status"] });
    },
  });
}

// ── Deduction types ───────────────────────────────────────────────────────────

export interface XeroDeductionType {
  id: string;
  name: string;
}

export function useXeroDeductionTypes(enabled = true) {
  return useQuery({
    queryKey: ["xero-deduction-types"],
    queryFn: () => get<{ types: XeroDeductionType[]; saved_id: string | null }>("/xero/deduction-types"),
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useSaveAdvanceDeductionType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deduction_type_id: string) =>
      put("/xero/advance-deduction-type", { deduction_type_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xero-deduction-types"] });
      toastSuccess("Deduction type saved");
    },
    onError: (err: any) => toastError(err.message || "Failed to save"),
  });
}

// ── Apply advance deductions to open pay run ──────────────────────────────────

export function useApplyAdvanceDeductions() {
  return useMutation({
    mutationFn: (advances: Array<{ staff_id: number; amount: number }>) => {
      const promise = post("/xero/apply-advance-deductions", { advances });
      return toastPromise(promise, {
        loading: "Applying advance deductions in Xero…",
        success: (d: any) => d.message,
        error: (err: any) => err.message || "Failed to apply deductions",
      });
    },
  });
}

// ── Send payroll to Xero ──────────────────────────────────────────────────────

export interface SendToXeroPayload {
  entries: Array<{
    shift_id: number;
    staff_id: number;
    hours: number;
    rate: number;
    amount: number;
    date: string;
  }>;
  pay_period_start: string;
  pay_period_end: string;
  notes?: string;
}

export function useSendPayrollToXero() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendToXeroPayload) => {
      const promise = post("/xero/send-payroll", payload);
      return toastPromise(promise, {
        loading: "Sending to Xero...",
        success: "Payroll sent to Xero",
        error: (err) => err.message || "Failed to send to Xero",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-summary"] });
      qc.invalidateQueries({ queryKey: ["payroll-batches"] });
    },
  });
}
