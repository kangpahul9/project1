import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
/// <reference types="vitest" />

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
      "/staff": "http://localhost:3000",
      "/cash": "http://localhost:3000",
      "/bank": "http://localhost:3000",
      "/settings": "http://localhost:3000",
      "/restaurant": "http://localhost:3000",
      "/roster": "http://localhost:3000",
      "/payroll": "http://localhost:3000",
      "/billing": "http://localhost:3000",
      "/xero": "http://localhost:3000",
      "/ai": "http://localhost:3000",
      "/combos": "http://localhost:3000",
      "/eftpos": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
});
