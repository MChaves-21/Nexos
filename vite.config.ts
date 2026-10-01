/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Módulos puros compartilhados com as Edge Functions
      "@shared": path.resolve(__dirname, "./supabase/functions/_shared"),
    },
  },
  build: {
    sourcemap: true,
  },
  // Vitest: os testes E2E (Playwright) ficam de fora
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
}));
