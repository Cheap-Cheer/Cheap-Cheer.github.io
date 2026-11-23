import { execFile } from "node:child_process";
import { access, appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const posterDir = "public/posters";
const indexPath = "movie-posters.json";
const checkOnly = process.argv.includes("--needs-download");
const token = process.env.TMDB_READ_ACCESS_TOKEN;

const records = JSON.parse(await readFile("movies.json", "utf8")).records;
const previous = JSON.parse(await readFile(indexPath, "utf8"));
const normalize = (text) => text.normalize("NFKC").replace(/[\p{P}\p{Z}\s]/gu, "").toLowerCase();

function keyOf(record) {
  return JSON.stringify([record.title, record.releaseYear ?? null, record.tmdbId ?? null]);
}

function fileOf(tmdbPath) {
  return join(posterDir, `${tmdbPath.slice(1, -4)}.webp`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function request(path, params = {}) {
  if (!token) throw new Error("Configure the TMDB_READ_ACCESS_TOKEN Actions secret.");
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.search = new URLSearchParams({ language: "zh-CN", ...params });
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
  return response.json();
}

const index = Object.create(null);
const pending = [];
for (const record of records) {
  const key = keyOf(record);
  if (previous[key]) index[key] = previous[key];
  else pending.push(record);
}

if (checkOnly) {
  let missing = pending.length > 0;
  if (!missing) {
    for (const path of Object.values(index)) {
      if (!await exists(fileOf(path))) {
        missing = true;
        break;
      }
    }
  }
  console.log(missing ? "yes" : "no");
  process.exit(0);
}

const warnings = [];
for (const record of pending) {
  let movie;
  if (Number.isSafeInteger(record.tmdbId) && record.tmdbId > 0) {
    movie = await request(`movie/${record.tmdbId}`);
  } else if (Number.isInteger(record.releaseYear)) {
    const result = await request("search/movie", {
      query: record.title,
      primary_release_year: String(record.releaseYear),
    });
    const matches = result.results.filter((item) => (
      Number(item.release_date?.slice(0, 4)) === record.releaseYear
      && [item.title, item.original_title].some((title) => title && normalize(title) === normalize(record.title))
    ));
    if (result.total_pages === 1 && matches.length === 1) movie = matches[0];
  }
  if (/^\/[A-Za-z0-9]+\.jpg$/.test(movie?.poster_path)) {
    index[keyOf(record)] = movie.poster_path;
    continue;
  }
  const message = `未匹配海报：${record.title} (${record.releaseYear ?? ""})，可填写 tmdbId`;
  warnings.push(message);
  console.warn(message);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning::${message}`);
}

await mkdir(posterDir, { recursive: true });
const referenced = new Set();
const missingFiles = [];
for (const path of Object.values(index)) {
  if (!/^\/[A-Za-z0-9]+\.jpg$/.test(path)) continue;
  const target = fileOf(path);
  referenced.add(target);
  if (!await exists(target) && !missingFiles.some((item) => item.target === target)) {
    missingFiles.push({ path, target });
  }
}

async function download({ path, target }) {
  const response = await fetch(`https://image.tmdb.org/t/p/w342${path}`, {
    headers: { Accept: "image/jpeg" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`海报下载失败 ${path} HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`海报不是 JPEG：${path}`);
  const jpeg = join(tmpdir(), `poster-${path.slice(1)}`);
  await writeFile(jpeg, bytes);
  await exec("cwebp", ["-quiet", "-q", "80", jpeg, "-o", target]);
  await rm(jpeg, { force: true });
}

const queue = [...missingFiles];
await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
  while (queue.length) await download(queue.shift());
}));

for (const name of await readdir(posterDir).catch(() => [])) {
  const full = join(posterDir, name);
  if (!referenced.has(full)) await rm(full);
}

const ordered = {};
for (const record of records) {
  const key = keyOf(record);
  if (index[key]) ordered[key] = index[key];
}
const next = `${JSON.stringify(ordered, null, 2)}\n`;
if (next !== await readFile(indexPath, "utf8")) await writeFile(indexPath, next);

if (warnings.length && process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### 未匹配海报\n${warnings.map((item) => `- ${item}`).join("\n")}\n`);
}
