const rawApiBase = import.meta.env.VITE_API_URL;

export const API_BASE =
  typeof rawApiBase === "string" && rawApiBase.trim() && rawApiBase !== "undefined"
    ? rawApiBase.replace(/\/+$/, "")
    : "";

// Root server URL — strips "/api" suffix so uploads served at /uploads work
export const SERVER_BASE = API_BASE.replace(/\/api$/, "");

export function withApiBase(path: string): string {
  if (!path) return API_BASE;
  if (!API_BASE) return path;
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
}

// Use this for /uploads/... file paths (NOT under /api)
export function withUploads(path: string): string {
  if (!path) return SERVER_BASE;
  if (path.startsWith("/")) return `${SERVER_BASE}${path}`;
  return `${SERVER_BASE}/${path}`;
}
