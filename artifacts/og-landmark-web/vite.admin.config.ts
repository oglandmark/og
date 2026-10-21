import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const artifactRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/admin/rn-assets/",
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      "react-native": "react-native-web",
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.join(artifactRoot, "public/admin/rn-assets"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(artifactRoot, "admin-react/main.tsx"),
      output: {
        entryFileNames: "admin.js",
        chunkFileNames: "chunk-[name].js",
        assetFileNames: "admin.css",
      },
    },
  },
});
