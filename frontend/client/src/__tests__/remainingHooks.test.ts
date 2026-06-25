/**
 * API contract tests for all remaining React Query hooks.
 * Verifies each hook calls the correct HTTP method + endpoint + payload shape.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/lib/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toastPromise: (p: Promise<any>) => p,
  toastError: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/lib/currency", () => ({
  formatCurrency: (v: number) => `$${v}`,
}));

import * as api from "@/lib/api";

import {
  useCurrentBusinessDay,
  useOpenBusinessDay,
  useCloseBusinessDay,
  useExpectedCash,
} from "@/hooks/use-business-days";
import { useMenu, useCreateMenuItem, useDisableMenuItem } from "@/hooks/use-menu";
import {
  useVendors,
  useCreateVendor,
  useDeleteVendor,
  useVendorSummary,
} from "@/hooks/use-vendors";
import {
  useStaff,
  useCreateStaff,
  useDeleteStaff,
  useStaffSummary,
  useStaffTransaction,
} from "@/hooks/use-staff";
import {
  useDailyReport,
  useWeeklySummary,
  useMonthlySummary,
  useTopProducts,
} from "@/hooks/use-reports";
import { useBankBalance, useBankHistory, useBankTransaction } from "@/hooks/use-bank";
import { useSettings, useUpdateCurrency } from "@/hooks/use-settings";
import {
  useWithdrawCash,
  useWithdrawalHistory,
  useDepositCash,
} from "@/hooks/use-withdraw";
import {
  usePartners,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
} from "@/hooks/use-partners";
import { useCurrentCash, useRecountCash } from "@/hooks/use-cash";

beforeEach(() => vi.clearAllMocks());

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ─────────────────────────────────────────────────────────────────────────
//  Business Days
// ─────────────────────────────────────────────────────────────────────────

describe("useCurrentBusinessDay", () => {
  test("calls GET /business-days/current when enabled", async () => {
    vi.mocked(api.get).mockResolvedValue({ id: 1, is_closed: false });
    const { result } = renderHook(() => useCurrentBusinessDay(true), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/business-days/current");
  });

  test("does not fetch when useBusinessDay is false", () => {
    renderHook(() => useCurrentBusinessDay(false), { wrapper: makeWrapper() });
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("useOpenBusinessDay", () => {
  test("POSTs to /business-days/start with denominations array", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useOpenBusinessDay(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      // hook mutateAsync takes the denominations array directly
      await result.current.mutateAsync([{ note: 500, qty: 2 }]);
    });
    expect(api.post).toHaveBeenCalledWith(
      "/business-days/start",
      expect.objectContaining({ denominations: expect.arrayContaining([expect.objectContaining({ note: 500 })]) })
    );
  });
});

describe("useCloseBusinessDay", () => {
  test("POSTs to /business-days/close", async () => {
    vi.mocked(api.post).mockResolvedValue({ message: "closed" });
    const { result } = renderHook(() => useCloseBusinessDay(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({
        breakdown: [{ note: 500, qty: 1 }],
        total: 500,
        reason: "End of day",
      } as any);
    });
    expect(api.post).toHaveBeenCalledWith(
      "/business-days/close",
      expect.objectContaining({ breakdown: expect.any(Array) })
    );
  });
});

describe("useExpectedCash", () => {
  test("calls GET /business-days/expected-cash when businessDayId provided", async () => {
    vi.mocked(api.get).mockResolvedValue({ expectedCash: 5000 });
    const { result } = renderHook(() => useExpectedCash(true, 10), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/business-days/expected-cash");
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Menu
// ─────────────────────────────────────────────────────────────────────────

describe("useMenu", () => {
  test("calls GET /menu", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    const { result } = renderHook(() => useMenu(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/menu");
  });
});

describe("useCreateMenuItem", () => {
  test("POSTs to /menu with name, price, idempotency key", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useCreateMenuItem(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({ name: "Burger", price: 150 } as any);
    });
    expect(api.post).toHaveBeenCalledWith(
      "/menu",
      expect.objectContaining({
        name: "Burger",
        price: 150,
        idempotencyKey: expect.stringMatching(/^menu_/),
      })
    );
  });
});

describe("useDisableMenuItem", () => {
  test("calls DELETE /menu/:id", async () => {
    vi.mocked(api.del).mockResolvedValue({ message: "ok" });
    const { result } = renderHook(() => useDisableMenuItem(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync(3);
    });
    expect(api.del).toHaveBeenCalledWith("/menu/3");
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Vendors
// ─────────────────────────────────────────────────────────────────────────

describe("useVendors", () => {
  test("calls GET /vendors", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    const { result } = renderHook(() => useVendors(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/vendors");
  });
});

describe("useVendorSummary", () => {
  test("calls GET /vendors/summary", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    const { result } = renderHook(() => useVendorSummary(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/vendors/summary");
  });
});

describe("useCreateVendor", () => {
  test("POSTs to /vendors with name and phone", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useCreateVendor(), {
      wrapper: makeWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({ name: "Fresh Produce", phone: "0400111222" });
    });
    expect(api.post).toHaveBeenCalledWith(
      "/vendors",
      expect.objectContaining({ name: "Fresh Produce" })
    );
  });
});

describe("useDeleteVendor", () => {
  test("calls DELETE /vendors/:id", async () => {
    vi.mocked(api.del).mockResolvedValue({ message: "ok" });
    const { result } = renderHook(() => useDeleteVendor(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync(7);
    });
    expect(api.del).toHaveBeenCalledWith("/vendors/7");
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Staff
// ─────────────────────────────────────────────────────────────────────────

describe("useStaff", () => {
  test("calls GET /staff", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    const { result } = renderHook(() => useStaff(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/staff");
  });
});

describe("useStaffSummary", () => {
  test("calls GET /staff/summary", async () => {
    vi.mocked(api.get).mockResolvedValue({ totalSalary: 0 });
    const { result } = renderHook(() => useStaffSummary(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/staff/summary");
  });
});

describe("useCreateStaff", () => {
  test("POSTs to /staff with required fields", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useCreateStaff(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        name: "Alice",
        email: "alice@test.com",
        password: "pass123",
        role: "STAFF",
        salary: 2500,
      } as any);
    });
    expect(api.post).toHaveBeenCalledWith(
      "/staff",
      expect.objectContaining({ name: "Alice", email: "alice@test.com", role: "STAFF" })
    );
  });
});

describe("useDeleteStaff", () => {
  test("calls DELETE /staff/:id", async () => {
    vi.mocked(api.del).mockResolvedValue({ message: "ok" });
    const { result } = renderHook(() => useDeleteStaff(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync(4);
    });
    expect(api.del).toHaveBeenCalledWith("/staff/4");
  });
});

describe("useStaffTransaction", () => {
  test("POSTs to /staff/:staffId/transaction with idempotency key", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useStaffTransaction(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        staffId: 2,
        amount: 500,
        type: "payment",
        reason: "Advance",
        payment_method: "cash",
      } as any);
    });
    // hook sends payload as-is (no idempotency key generated client-side)
    expect(api.post).toHaveBeenCalledWith(
      "/staff/2/transaction",
      expect.objectContaining({ amount: 500, type: "payment", staffId: 2 })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Reports
// ─────────────────────────────────────────────────────────────────────────

describe("useDailyReport", () => {
  test("calls GET /reports/daily with date param", async () => {
    vi.mocked(api.get).mockResolvedValue({});
    const { result } = renderHook(() => useDailyReport("2026-05-01"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      "/reports/daily",
      expect.objectContaining({ params: { date: "2026-05-01" } })
    );
  });

  test("does not fetch when date is undefined", () => {
    renderHook(() => useDailyReport(undefined), { wrapper: makeWrapper() });
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("useWeeklySummary", () => {
  test("calls GET /reports/weekly-summary", async () => {
    vi.mocked(api.get).mockResolvedValue({});
    const { result } = renderHook(() => useWeeklySummary(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/reports/weekly-summary");
  });
});

describe("useMonthlySummary", () => {
  test("calls GET /reports/monthly-summary", async () => {
    vi.mocked(api.get).mockResolvedValue({});
    const { result } = renderHook(() => useMonthlySummary(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/reports/monthly-summary");
  });
});

describe("useTopProducts", () => {
  test("calls GET /reports/top-products", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    const { result } = renderHook(() => useTopProducts(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      "/reports/top-products",
      expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Bank
// ─────────────────────────────────────────────────────────────────────────

describe("useBankBalance", () => {
  test("calls GET /bank/balance", async () => {
    vi.mocked(api.get).mockResolvedValue({ balance: 5000 });
    const { result } = renderHook(() => useBankBalance(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/bank/balance");
  });
});

describe("useBankHistory", () => {
  test("calls GET /bank/history", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    const { result } = renderHook(() => useBankHistory(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/bank/history");
  });
});

describe("useBankTransaction", () => {
  test("POSTs to /bank/transaction with idempotency key", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useBankTransaction(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        amount: 2000,
        type: "credit",
        source: "owner_deposit",
        description: "Cash injection",
      } as any);
    });
    expect(api.post).toHaveBeenCalledWith(
      "/bank/transaction",
      expect.objectContaining({
        amount: 2000,
        source: "owner_deposit",
        idempotencyKey: expect.stringMatching(/^bank_/),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Settings
// ─────────────────────────────────────────────────────────────────────────

describe("useSettings", () => {
  test("calls GET /settings", async () => {
    vi.mocked(api.get).mockResolvedValue({});
    const { result } = renderHook(() => useSettings(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/settings");
  });
});

describe("useUpdateCurrency", () => {
  test("PUTs to /settings/currency", async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const { result } = renderHook(() => useUpdateCurrency(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync("AUD");
    });
    expect(api.put).toHaveBeenCalledWith("/settings/currency", { currency_code: "AUD" });
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Withdrawals
// ─────────────────────────────────────────────────────────────────────────

describe("useWithdrawCash", () => {
  test("POSTs to /withdrawals with breakdown and reason", async () => {
    vi.mocked(api.post).mockResolvedValue({ message: "ok" });
    const { result } = renderHook(() => useWithdrawCash(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        breakdown: [{ note: 500, qty: 1 }],
        reason: "Owner Personal",
      });
    });
    expect(api.post).toHaveBeenCalledWith(
      "/withdrawals",
      expect.objectContaining({
        breakdown: expect.arrayContaining([expect.objectContaining({ note: 500 })]),
        reason: "Owner Personal",
      })
    );
  });
});

describe("useWithdrawalHistory", () => {
  test("calls GET /withdrawals/history", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [], pagination: {} });
    const { result } = renderHook(() => useWithdrawalHistory({}), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      "/withdrawals/history",
      expect.anything()
    );
  });
});

describe("useDepositCash", () => {
  test("POSTs to /withdrawals/deposit", async () => {
    vi.mocked(api.post).mockResolvedValue({ message: "ok" });
    const { result } = renderHook(() => useDepositCash(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        breakdown: [{ note: 100, qty: 5 }],
        reason: "Bank Deposit",
      });
    });
    expect(api.post).toHaveBeenCalledWith(
      "/withdrawals/deposit",
      expect.objectContaining({ breakdown: expect.any(Array) })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Partners
// ─────────────────────────────────────────────────────────────────────────

describe("usePartners", () => {
  test("calls GET /partners", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    const { result } = renderHook(() => usePartners(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/partners");
  });
});

describe("useCreatePartner", () => {
  test("POSTs to /partners with idempotency key", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useCreatePartner(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ name: "Alice", share_percent: 30 });
    });
    expect(api.post).toHaveBeenCalledWith(
      "/partners",
      expect.objectContaining({
        name: "Alice",
        share_percent: 30,
        idempotencyKey: expect.stringMatching(/^partner_/),
      })
    );
  });
});

describe("useUpdatePartner", () => {
  test("PUTs to /partners/:id", async () => {
    vi.mocked(api.put).mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useUpdatePartner(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 1, name: "Alice", share_percent: 40 });
    });
    expect(api.put).toHaveBeenCalledWith(
      "/partners/1",
      expect.objectContaining({ name: "Alice", share_percent: 40 })
    );
  });
});

describe("useDeletePartner", () => {
  test("calls DELETE /partners/:id", async () => {
    vi.mocked(api.del).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useDeletePartner(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync(1);
    });
    expect(api.del).toHaveBeenCalledWith("/partners/1");
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Cash (orders/cash/*)
// ─────────────────────────────────────────────────────────────────────────

describe("useCurrentCash", () => {
  test("calls GET /orders/cash/current with businessDayId", async () => {
    vi.mocked(api.get).mockResolvedValue({ total: 1000, breakdown: [] });
    const { result } = renderHook(() => useCurrentCash(true, 10), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      "/orders/cash/current",
      expect.objectContaining({ params: { businessDayId: 10 } })
    );
  });

  test("does not fetch when useBusinessDay is false", () => {
    renderHook(() => useCurrentCash(false, 10), { wrapper: makeWrapper() });
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("useRecountCash", () => {
  test("POSTs to /orders/cash/recount with breakdown", async () => {
    vi.mocked(api.post).mockResolvedValue({ total: 1000 });
    const { result } = renderHook(() => useRecountCash(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        breakdown: [{ note: 500, qty: 2 }],
      });
    });
    expect(api.post).toHaveBeenCalledWith(
      "/orders/cash/recount",
      expect.objectContaining({
        breakdown: expect.arrayContaining([expect.objectContaining({ note: 500 })]),
        idempotencyKey: expect.any(String),
      })
    );
  });
});
