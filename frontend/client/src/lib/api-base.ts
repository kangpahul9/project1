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

// Use this for /uploads/... file paths — appends JWT so the protected route accepts the request
export function withUploads(path: string): string {
  if (!path) return SERVER_BASE;
  const token = localStorage.getItem("token");
  const base = path.startsWith("/") ? `${SERVER_BASE}${path}` : `${SERVER_BASE}/${path}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
