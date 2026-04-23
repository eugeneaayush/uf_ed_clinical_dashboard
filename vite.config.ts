import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: /^@\/(.*)$/,
        replacement: fileURLToPath(new URL("./src/$1", import.meta.url)),
      },
    ],
  },
  build: {
    sourcemap: false,
    target: "es2020",
  },
  server: {
    port: 5173,
    host: true,
  },
});
