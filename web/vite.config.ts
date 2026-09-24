import { defineConfig } from "vitest/config";
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000",
        // Django must see the browser Host for its same-origin CSRF check.
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
