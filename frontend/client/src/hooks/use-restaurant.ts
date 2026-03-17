import { useQuery } from "@tanstack/react-query";
import { withApiBase } from "@/lib/api-base";

export function useRestaurantInfo() {
  return useQuery({
    queryKey: ["restaurant-info"],
    queryFn: async () => {
      const token = localStorage.getItem("token");

      const res = await fetch(withApiBase("/restaurant/info"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error("Failed to fetch restaurant info");

      return res.json();
    }
  });
}