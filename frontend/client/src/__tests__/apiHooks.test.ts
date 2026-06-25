/**
 * API contract tests for React Query hooks.
 * Verifies that each hook calls the correct HTTP method + endpoint with the
 * expected payload shape — catching frontend/backend path mismatches before
 * they reach production.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ── Mock the API module so no real HTTP is made ──────────────────────────
vi.mock("@/lib/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

// Toast helpers — strip side-effects, pass the promise through
vi.mock("@/hooks/use-toast", () => ({
  toastPromise: (p: Promise<any>) => p,
  toastError: vi.fn(),
  toast: vi.fn(),
}));

// wouter — needed by useLogin
vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

import * as api from "@/lib/api";

// Clear call counts between every test
beforeEach(() => vi.clearAllMocks());

import {
  useOrders,
  useCreateOrder,
  useDeleteOrder,
  useDeletedOrders,
  useOrderDetails,
} from "@/hooks/use-orders";
import { useExpenses, useCreateExpense, useDeleteExpense } from "@/hooks/use-expenses";
import { useLogin, useAuthStore } from "@/hooks/use-auth";

// ── Test helper: fresh QueryClient per test ───────────────────────────────
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
//  useOrders
// ─────────────────────────────────────────────────────────────────────────

describe("useOrders", () => {
  beforeEach(() => vi.mocked(api.get).mockResolvedValue([]));

  test("calls GET /orders without params when not using business day", async () => {
    const { result } = renderHook(() => useOrders(false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith(
      "/orders",
      expect.objectContaining({ params: {} })
    );
  });

  test("calls GET /orders with businessDayId param when using business day", async () => {
    const { result } = renderHook(() => useOrders(true, 42), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith(
      "/orders",
      expect.objectContaining({ params: { businessDayId: 42 } })
    );
  });

  test("does not fetch when businessDayId is missing in businessDay mode", () => {
    const { result } = renderHook(() => useOrders(true, undefined), {
      wrapper: makeWrapper(),
    });

    // query is disabled — isLoading is false and no fetch
    expect(result.current.isFetching).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  useCreateOrder
// ─────────────────────────────────────────────────────────────────────────

describe("useCreateOrder", () => {
  test("POSTs to /orders with correct payload shape and idempotency key", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 10 });

    const { result } = renderHook(() => useCreateOrder(false), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        items: [{ id: 1, name: "Burger", price: 150, quantity: 2 }],
        paymentMethod: "cash",
        tableNumber: "T1",
      } as any);
    });

    expect(api.post).toHaveBeenCalledWith(
      "/orders",
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ name: "Burger", quantity: 2 }),
        ]),
        paymentMethod: "cash",
        idempotencyKey: expect.stringMatching(/^order_/),
      })
    );
  });

  test("does NOT include businessDayId when not using business day", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 11 });

    const { result } = renderHook(() => useCreateOrder(false), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        items: [{ id: 1, name: "Coffee", price: 50, quantity: 1 }],
        paymentMethod: "online",
        businessDayId: 99,
      } as any);
    });

    const call = vi.mocked(api.post).mock.calls[0][1] as any;
    expect(call.businessDayId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  useDeleteOrder
// ─────────────────────────────────────────────────────────────────────────

describe("useDeleteOrder", () => {
  test("POSTs to /orders/:id/delete (soft delete, not DELETE method)", async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteOrder(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(5);
    });

    expect(api.post).toHaveBeenCalledWith(
      "/orders/5/delete",
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  useDeletedOrders
// ─────────────────────────────────────────────────────────────────────────

describe("useDeletedOrders", () => {
  test("calls GET /orders/deleted", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    const { result } = renderHook(() => useDeletedOrders(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith("/orders/deleted");
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  useOrderDetails
// ─────────────────────────────────────────────────────────────────────────

describe("useOrderDetails", () => {
  test("calls GET /orders/:id", async () => {
    vi.mocked(api.get).mockResolvedValue({ id: 7, items: [] });

    const { result } = renderHook(() => useOrderDetails(7), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith("/orders/7");
  });

  test("does not fetch when id is undefined", () => {
    const { result } = renderHook(() => useOrderDetails(undefined), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  useExpenses
// ─────────────────────────────────────────────────────────────────────────

describe("useExpenses", () => {
  test("calls GET /expenses without params in non-business-day mode", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    const { result } = renderHook(() => useExpenses(false), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.get).toHaveBeenCalledWith(
      "/expenses",
      expect.objectContaining({ params: {} })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  useCreateExpense
// ─────────────────────────────────────────────────────────────────────────

describe("useCreateExpense", () => {
  test("POSTs to /expenses with idempotency key", async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useCreateExpense(false), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        amount: 200,
        category: "other",
        paymentMode: "cash",
      } as any);
    });

    expect(api.post).toHaveBeenCalledWith(
      "/expenses",
      expect.objectContaining({
        amount: 200,
        category: "other",
        paymentMode: "cash",
        idempotencyKey: expect.stringMatching(/^exp_/),
      })
    );
  });

  test("rejects supplies category without vendor (frontend guard)", async () => {
    const { result } = renderHook(() => useCreateExpense(false), {
      wrapper: makeWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          amount: 500,
          category: "supplies",
          paymentMode: "cash",
        } as any);
      })
    ).rejects.toThrow("Vendor required for supplies");

    expect(api.post).not.toHaveBeenCalled();
  });

  test("rejects salary category without staff_id (frontend guard)", async () => {
    const { result } = renderHook(() => useCreateExpense(false), {
      wrapper: makeWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          amount: 1000,
          category: "salary",
          paymentMode: "cash",
        } as any);
      })
    ).rejects.toThrow("Staff required for salary");

    expect(api.post).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  useDeleteExpense
// ─────────────────────────────────────────────────────────────────────────

describe("useDeleteExpense", () => {
  test("calls DELETE /expenses/:id", async () => {
    vi.mocked(api.del).mockResolvedValue({ message: "Deleted" });

    const { result } = renderHook(() => useDeleteExpense(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    expect(api.del).toHaveBeenCalledWith("/expenses/3");
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  useLogin — frontend → backend contract
// ─────────────────────────────────────────────────────────────────────────

describe("useLogin", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null });
  });

  test("POSTs credentials to /auth/login", async () => {
    vi.mocked(api.post).mockResolvedValue({
      token: "jwt-token-abc",
      userId: 1,
      name: "Admin",
      role: "ADMIN",
    });

    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        restaurantUid: "my-resto",
        email: "admin@test.com",
        password: "secret",
      });
    });

    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      restaurantUid: "my-resto",
      email: "admin@test.com",
      password: "secret",
    });
  });

  test("stores JWT token in localStorage on success", async () => {
    vi.mocked(api.post).mockResolvedValue({
      token: "jwt-token-xyz",
      userId: 2,
      name: "Staff",
      role: "STAFF",
    });

    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        restaurantUid: "my-resto",
        email: "staff@test.com",
        password: "pass",
      });
    });

    expect(localStorage.getItem("token")).toBe("jwt-token-xyz");
  });

  test("saves user to auth store on success", async () => {
    vi.mocked(api.post).mockResolvedValue({
      token: "jwt-token-qrs",
      userId: 5,
      name: "Alice",
      role: "ADMIN",
    });

    const { result } = renderHook(() => useLogin(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        restaurantUid: "r1",
        email: "alice@test.com",
        password: "pw",
      });
    });

    const { user } = useAuthStore.getState();
    expect(user?.id).toBe(5);
    expect(user?.name).toBe("Alice");
    expect(user?.role).toBe("ADMIN");
  });
});
