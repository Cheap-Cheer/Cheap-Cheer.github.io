import { readFileSync } from "node:fs";
import { join } from "node:path";

export function preloadsFor(moduleUrl) {
  const seen = new Set();
  const ordered = [];
  const visit = (url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    ordered.push(url);
    const source = readFileSync(join("public", url), "utf8");
    for (const line of source.split("\n")) {
      if (line.includes("import(")) continue;
      const match = line.match(/from\s+["'](\.[^"']+)["']/) ?? line.match(/import\s+["'](\.[^"']+)["']/);
      if (!match) continue;
      visit(new URL(match[1], `https://local${url}`).pathname);
    }
  };
  visit("/js/main.js");
  if (moduleUrl) visit(moduleUrl);
  return ordered;
}
