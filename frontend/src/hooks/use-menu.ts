import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useMenu() {
  return useQuery({
    queryKey: [api.menu.list.path],
    queryFn: async () => {
      const res = await fetch(api.menu.list.path);
      if (!res.ok) throw new Error("Failed to fetch menu");
      return api.menu.list.responses[200].parse(await res.json());
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: [api.menu.categories.path],
    queryFn: async () => {
      const res = await fetch(api.menu.categories.path);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return api.menu.categories.responses[200].parse(await res.json());
    },
  });
}
