const rawApiBase = import.meta.env.VITE_API_URL;

export const API_BASE =
  typeof rawApiBase === "string" && rawApiBase.trim() && rawApiBase !== "undefined"
    ? rawApiBase.replace(/\/+$/, "")
    : "";

export function withApiBase(path: string): string {
  if (!path) return API_BASE;
  if (!API_BASE) return path;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}
