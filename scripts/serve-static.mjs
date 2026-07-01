#!/usr/bin/env node

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || process.argv[2] || 8768);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
]);

function send(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const absolutePath = path.resolve(rootDir, relativePath);
  if (!absolutePath.startsWith(`${rootDir}${path.sep}`) && absolutePath !== rootDir) {
    return null;
  }
  return absolutePath;
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed");
    return;
  }

  const requestedPath = resolveRequestPath(request.url || "/");
  if (!requestedPath) {
    send(response, 403, "Forbidden");
    return;
  }

  const filePath = fs.existsSync(requestedPath) && fs.statSync(requestedPath).isDirectory()
    ? path.join(requestedPath, "index.html")
    : requestedPath;

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, error.code === "ENOENT" ? 404 : 500, error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : data);
  });
});

server.listen(port, host, () => {
  console.log(`Serving ${rootDir}`);
  console.log(`Open http://${host}:${port}/`);
});
