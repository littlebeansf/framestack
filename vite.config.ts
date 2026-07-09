import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor: React ecosystem
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          // Vendor: TanStack Query
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-query";
          }
          // Vendor: Radix UI / shadcn
          if (id.includes("node_modules/@radix-ui") || id.includes("node_modules/cmdk")) {
            return "vendor-ui";
          }
          // Vendor: Leaflet (already split but ensure)
          if (id.includes("node_modules/leaflet")) {
            return "vendor-leaflet";
          }
          // Vendor: Lucide icons
          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/react-icons")) {
            return "vendor-icons";
          }
          // Vendor: wouter router
          if (id.includes("node_modules/wouter")) {
            return "vendor-router";
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
