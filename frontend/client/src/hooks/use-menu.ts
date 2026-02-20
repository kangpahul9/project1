import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function useMenu() {
  return useQuery({
    queryKey: ["/menu"],
    queryFn: async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_BASE}/menu`, {
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch menu");
  }

  const data = await res.json();

  return data.map((item: any) => ({
    ...item,
    price: Number(item.price),
  }));
},
  });
}

// export function useCategories() {
//   return useQuery({
//     queryKey: [api.menu.categories.path],
//     queryFn: async () => {
//       const res = await fetch(api.menu.categories.path);
//       if (!res.ok) throw new Error("Failed to fetch categories");
//       return api.menu.categories.responses[200].parse(await res.json());
//     },
//   });
// }
