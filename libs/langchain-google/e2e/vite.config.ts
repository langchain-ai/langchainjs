import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all requests that match the Google API pattern
      "/proxy/google": {
        target: "https://generativelanguage.googleapis.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/google/, ""),
      },
    },
  },
});
