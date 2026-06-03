import { describe, test, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/hooks/use-auth";

const mockUser = { id: 1, name: "Admin User", role: "ADMIN" as const };

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
  });

  test("initial state has no user", () => {
    const { user } = useAuthStore.getState();
    expect(user).toBeNull();
  });

  test("setUser stores a user", () => {
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  test("setUser can be called with null to clear", () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  test("clear removes the user", () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().user).toBeNull();
  });

  test("setUser stores all user fields correctly", () => {
    useAuthStore.getState().setUser({ id: 99, name: "Staff Member", role: "STAFF" });
    const { user } = useAuthStore.getState();
    expect(user?.id).toBe(99);
    expect(user?.name).toBe("Staff Member");
    expect(user?.role).toBe("STAFF");
  });

  test("multiple setUser calls overwrite previous state", () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser({ id: 2, name: "Other", role: "STAFF" });
    expect(useAuthStore.getState().user?.id).toBe(2);
  });
});
