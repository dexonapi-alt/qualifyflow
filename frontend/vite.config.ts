import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": process.env.QF_API_PROXY_TARGET || "http://127.0.0.1:8000",
    },
  },
  preview: { host: "127.0.0.1" },
});
