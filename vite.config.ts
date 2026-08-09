import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  cacheDir: "node_modules/.vite-fdtd",
  define: {
    __FDTD_BUILD_VERSION__: JSON.stringify(process.env.FDTD_BUILD_VERSION || "dev"),
  },
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@carbon/react",
      "@carbon/react/icons",
      "plotly.js-basic-dist-min",
      "@carbon/react > prop-types",
    ],
    exclude: ["@jorpago2/scientific-ui"],
  },
  server: {
    host: "127.0.0.1",
    port: 8768,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
});
