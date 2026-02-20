import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/auth": "http://localhost:3000",
      "/menu": "http://localhost:3000",
      "/orders": "http://localhost:3000",
      "/expenses": "http://localhost:3000",
      "/vendors": "http://localhost:3000",
      "/business-days": "http://localhost:3000",
      "/withdrawals": "http://localhost:3000",
      "/reports": "http://localhost:3000",
    },
  },
});
