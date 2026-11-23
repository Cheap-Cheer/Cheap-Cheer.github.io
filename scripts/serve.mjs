import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const root = normalize(join(process.cwd(), "dist"));
const port = 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function safePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = normalize(join(root, decoded.replace(/^\/+/, "")));
  if (file !== root && !file.startsWith(`${root}${sep}`)) return null;
  return file;
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
  const file = safePath(pathname);
  try {
    if (!file) throw new Error("forbidden");
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    const body = await readFile(join(root, "404.html"));
    response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  }
}).listen(port, () => {
  console.log(`http://localhost:${port}`);
});
