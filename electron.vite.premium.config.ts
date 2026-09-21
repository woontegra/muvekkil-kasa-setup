import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

/**
 * Premium renderer — ayrı Vite girişi.
 * electron-vite 3.x çoklu renderer anahtarı desteklemediği için ayrı config dosyası kullanılır.
 * Varsayılan `npm run build` ile birlikte çalıştırılır (`package.json`).
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
  },
  renderer: {
    root: resolve("src/renderer-premium"),
    cacheDir: resolve("node_modules/.vite-premium"),
    resolve: {
      alias: {
        "@premium": resolve("src/renderer-premium"),
        "@shared": resolve("src/shared"),
      },
    },
    plugins: [react()],
    build: {
      outDir: resolve("out/renderer-premium"),
      rollupOptions: {
        input: resolve("src/renderer-premium/index.html"),
      },
    },
  },
});
