import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const legacyRuntimeRoot = path.join(projectRoot, "src", "runtime");

function serveLegacyRuntime(): Plugin {
  return {
    name: "serve-legacy-runtime",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
          if (!pathname.startsWith("/src/runtime/") || !pathname.endsWith(".js")) return next();
          const filePath = path.resolve(legacyRuntimeRoot, pathname.slice("/src/runtime/".length));
          if (!filePath.startsWith(`${legacyRuntimeRoot}${path.sep}`)) {
            response.statusCode = 403;
            response.end("Forbidden");
            return;
          }
          response.setHeader("Content-Type", "text/javascript; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(await readFile(filePath));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  define: {
    __FDTD_BUILD_VERSION__: JSON.stringify(process.env.FDTD_BUILD_VERSION || "dev"),
  },
  plugins: [serveLegacyRuntime(), react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 8768,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
});
