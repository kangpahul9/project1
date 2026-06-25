/**
 * finalHooks.test.ts
 * Covers the remaining untested frontend hooks:
 *  - use-unpaid-orders  (useUnpaidOrders, useMarkOrderPaid, useOrderById)
 *  - use-restaurant     (useRestaurantInfo, useRestaurantSettings, useUpdateRestaurantInfo)
 *  - use-users          (useUsers, useCreateUser, useDeleteUser)
 *  - use-menuCategories (useMenuCategories, useCreateCategory, useUpdateCategory, useDisableCategory)
 *  - use-billing        (useSubscription, useCreateCheckout)
 *  - use-payroll        (usePayrollSummary)
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── api mock ──────────────────────────────────────────────────────────────────
vi.mock("@/lib/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

// ── toast mock ────────────────────────────────────────────────────────────────
vi.mock("@/hooks/use-toast", () => ({
  toastPromise: (p: Promise<any>) => p,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

// ── wouter (navigation) mock ─────────────────────────────────────────────────
vi.mock("wouter", () => ({
  useLocation: vi.fn(() => ["/", vi.fn()]),
  useRoute: vi.fn(() => [false, {}]),
  Link: ({ children }: any) => children,
}));

import * as api from "@/lib/api";

// Top-level hook imports — avoids dynamic import issues with Vitest's mock hoisting
import { useUnpaidOrders, useMarkOrderPaid, useOrderById } from "@/hooks/use-unpaid-orders";
import {
  useRestaurantInfo,
  useRestaurantSettings,
  useUpdateRestaurantInfo,
} from "@/hooks/use-restaurant";
import { useUsers, useCreateUser, useDeleteUser } from "@/hooks/use-users";
import {
  useMenuCategories,
  useCreateCategory,
  useUpdateCategory,
  useDisableCategory,
} from "@/hooks/use-menuCategories";
import { useSubscription, useCreateCheckout } from "@/hooks/use-billing";
import { usePayrollSummary } from "@/hooks/use-payroll";

beforeEach(() => vi.clearAllMocks());

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ────────────────────────────────────────────────────────────────────────────────
// use-unpaid-orders
// ────────────────────────────────────────────────────────────────────────────────

describe("useUnpaidOrders", () => {
  test("calls GET /orders/unpaid", async () => {
    (api.get as any).mockResolvedValueOnce([
      { id: 5, total: 300, amount_paid: 0, due_amount: 300 },
    ]);
    const { result } = renderHook(() => useUnpaidOrders(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/orders/unpaid");
    expect(result.current.data![0].id).toBe(5);
  });
});

describe("useMarkOrderPaid", () => {
  test("POSTs to /orders/:id/pay with idempotencyKey", async () => {
    (api.post as any).mockResolvedValueOnce({ message: "Paid" });
    const { result } = renderHook(() => useMarkOrderPaid(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 5, paymentMethod: "cash" });
    });
    const [url, body] = (api.post as any).mock.calls[0];
    expect(url).toBe("/orders/5/pay");
    expect(body).toHaveProperty("paymentMethod", "cash");
    expect(body).toHaveProperty("idempotencyKey");
    expect(typeof body.idempotencyKey).toBe("string");
    expect(body.idempotencyKey.length).toBeGreaterThan(0);
  });
});

describe("useOrderById", () => {
  test("is disabled when id is null", () => {
    const { result } = renderHook(() => useOrderById(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.get).not.toHaveBeenCalled();
  });

  test("calls GET /orders/:id when id is provided", async () => {
    (api.get as any).mockResolvedValueOnce({ id: 7, total: 500 });
    const { result } = renderHook(() => useOrderById(7), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/orders/7");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// use-restaurant
// ────────────────────────────────────────────────────────────────────────────────

describe("useRestaurantInfo", () => {
  test("calls GET /restaurant/info", async () => {
    (api.get as any).mockResolvedValueOnce({ id: 1, name: "KangFood", currency: "₹" });
    const { result } = renderHook(() => useRestaurantInfo(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/restaurant/info");
    expect(result.current.data!.name).toBe("KangFood");
  });
});

describe("useRestaurantSettings", () => {
  test("calls GET /restaurant/settings and applies safe defaults", async () => {
    (api.get as any).mockResolvedValueOnce({ use_business_day: false });
    const { result } = renderHook(() => useRestaurantSettings(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/restaurant/settings");
    expect(result.current.data!.use_business_day).toBe(false);
    expect(result.current.data).toHaveProperty("enable_cash_recount");
  });
});

describe("useUpdateRestaurantInfo", () => {
  test("PUTs to /restaurant/info with mapped payload", async () => {
    (api.put as any).mockResolvedValueOnce({ id: 1 });
    const { result } = renderHook(() => useUpdateRestaurantInfo(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ name: "New Name", logo_url: "/img.png" });
    });
    const [url, body] = (api.put as any).mock.calls[0];
    expect(url).toBe("/restaurant/info");
    expect(body.name).toBe("New Name");
    expect(body.logoUrl).toBe("/img.png");
    expect(body).not.toHaveProperty("logo_url"); // frontend maps logo_url → logoUrl
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// use-users
// ────────────────────────────────────────────────────────────────────────────────

describe("useUsers", () => {
  test("calls GET /users", async () => {
    (api.get as any).mockResolvedValueOnce([{ id: 1, name: "Alice", role: "ADMIN" }]);
    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/users");
  });
});

describe("useCreateUser", () => {
  test("POSTs to /users", async () => {
    (api.post as any).mockResolvedValueOnce({ id: 10 });
    const { result } = renderHook(() => useCreateUser(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        name: "Bob",
        email: "bob@test.com",
        password: "pass123",
        role: "STAFF",
      });
    });
    const [url, body] = (api.post as any).mock.calls[0];
    expect(url).toBe("/users");
    expect(body.email).toBe("bob@test.com");
    expect(body.role).toBe("STAFF");
  });
});

describe("useDeleteUser", () => {
  test("calls DELETE /users/:id", async () => {
    (api.del as any).mockResolvedValueOnce({ message: "deleted" });
    const { result } = renderHook(() => useDeleteUser(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync(7);
    });
    expect(api.del).toHaveBeenCalledWith("/users/7");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// use-menuCategories
// ────────────────────────────────────────────────────────────────────────────────

describe("useMenuCategories", () => {
  test("calls GET /menu/categories", async () => {
    (api.get as any).mockResolvedValueOnce([{ id: 1, name: "Drinks" }]);
    const { result } = renderHook(() => useMenuCategories(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/menu/categories");
  });
});

describe("useCreateCategory", () => {
  test("POSTs to /menu/categories with idempotencyKey", async () => {
    (api.post as any).mockResolvedValueOnce({ id: 3, name: "Starters" });
    const { result } = renderHook(() => useCreateCategory(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ name: "Starters", color: "#F59E0B" });
    });
    const [url, body] = (api.post as any).mock.calls[0];
    expect(url).toBe("/menu/categories");
    expect(body.name).toBe("Starters");
    expect(body.idempotencyKey).toMatch(/^cat_/);
  });
});

describe("useUpdateCategory", () => {
  test("PUTs to /menu/categories/:id", async () => {
    (api.put as any).mockResolvedValueOnce({ id: 3, name: "Updated" });
    const { result } = renderHook(() => useUpdateCategory(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 3, name: "Updated" });
    });
    const [url, body] = (api.put as any).mock.calls[0];
    expect(url).toBe("/menu/categories/3");
    expect(body.name).toBe("Updated");
    expect(body).not.toHaveProperty("id"); // id is extracted, not sent in body
  });
});

describe("useDisableCategory", () => {
  test("calls DELETE /menu/categories/:id", async () => {
    (api.del as any).mockResolvedValueOnce({ message: "Category disabled" });
    const { result } = renderHook(() => useDisableCategory(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync(3);
    });
    expect(api.del).toHaveBeenCalledWith("/menu/categories/3");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// use-billing
// ────────────────────────────────────────────────────────────────────────────────

describe("useSubscription", () => {
  test("calls GET /billing/subscription", async () => {
    (api.get as any).mockResolvedValueOnce({
      subscription_status: "active",
      subscription_valid_till: "2027-01-01",
    });
    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/billing/subscription");
    expect(result.current.data!.subscription_status).toBe("active");
  });
});

describe("useCreateCheckout", () => {
  test("POSTs to /billing/create-checkout and gets URL", async () => {
    (api.post as any).mockResolvedValueOnce({ url: "https://pay.stripe.com/abc" });
    const { result } = renderHook(() => useCreateCheckout(), { wrapper: createWrapper() });
    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (_) {
        // window.location.href may throw in jsdom; that's fine
      }
    });
    expect(api.post).toHaveBeenCalledWith("/billing/create-checkout", {});
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// use-payroll
// ────────────────────────────────────────────────────────────────────────────────

describe("usePayrollSummary", () => {
  test("is disabled when start/end are missing", () => {
    const { result } = renderHook(() => usePayrollSummary(undefined, undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.get).not.toHaveBeenCalled();
  });

  test("calls GET /payroll with date params when start & end provided", async () => {
    (api.get as any).mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => usePayrollSummary("2026-05-01", "2026-05-31", "roster"),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith("/payroll", {
      params: { start: "2026-05-01", end: "2026-05-31", mode: "roster" },
    });
  });
});
