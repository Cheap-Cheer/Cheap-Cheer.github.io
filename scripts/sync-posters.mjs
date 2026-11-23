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
const posterPath = /^\/[A-Za-z0-9]+\.jpg$/;

const records = JSON.parse(await readFile("movies.json", "utf8")).records;
const previous = JSON.parse(await readFile(indexPath, "utf8"));
const normalize = (text) => text.normalize("NFKC").replace(/[\p{P}\p{Z}\s]/gu, "").toLowerCase();

function keyOf(record) {
  return JSON.stringify([record.title, record.releaseYear ?? null, record.tmdbId ?? null]);
}

function fileOf(tmdbPath) {
  return join(posterDir, `${tmdbPath.slice(1, -4)}.webp`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const warnings = [];
let converterMissing = false;

function warn(message) {
  warnings.push(message);
  console.warn(message);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning::${message}`);
}

async function request(path, params = {}) {
  if (!token) throw new Error("Configure the TMDB_READ_ACCESS_TOKEN Actions secret.");
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.search = new URLSearchParams({ language: "zh-CN", ...params });
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) return response.json();
      const error = new Error(`TMDB HTTP ${response.status}`);
      if (response.status !== 429 && response.status < 500) error.permanent = true;
      throw error;
    } catch (error) {
      lastError = error;
      if (error.permanent || attempt === 3) break;
      await sleep(attempt * 1000);
    }
  }
  throw lastError;
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

for (const record of pending) {
  const label = `${record.title} (${record.releaseYear ?? ""})`;
  try {
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
    if (posterPath.test(movie?.poster_path)) {
      index[keyOf(record)] = movie.poster_path;
      continue;
    }
    warn(`未匹配海报：${label}，可填写 tmdbId`);
  } catch (error) {
    warn(`海报匹配失败：${label}：${error.message}`);
  }
}

await mkdir(posterDir, { recursive: true });
const missingFiles = [];
for (const path of Object.values(index)) {
  if (!posterPath.test(path)) continue;
  const target = fileOf(path);
  if (!await exists(target) && !missingFiles.some((item) => item.target === target)) {
    missingFiles.push({ path, target });
  }
}

async function download({ path, target }) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const jpeg = join(tmpdir(), `poster-${path.slice(1)}-${attempt}`);
    try {
      const response = await fetch(`https://image.tmdb.org/t/p/w342${path}`, {
        headers: { Accept: "image/jpeg" },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        if (response.status !== 429 && response.status < 500) error.permanent = true;
        throw error;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        throw Object.assign(new Error("海报不是 JPEG"), { permanent: true });
      }
      await writeFile(jpeg, bytes);
      await exec("cwebp", ["-quiet", "-q", "80", jpeg, "-o", target]);
      await rm(jpeg, { force: true });
      return;
    } catch (error) {
      lastError = error;
      await rm(jpeg, { force: true });
      await rm(target, { force: true });
      if (error.code === "ENOENT") {
        converterMissing = true;
        throw error;
      }
      if (error.permanent || attempt === 3) break;
      await sleep(attempt * 1000);
    }
  }
  throw lastError;
}

const queue = [...missingFiles];
await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
  while (queue.length && !converterMissing) {
    const item = queue.shift();
    if (!item) return;
    try {
      await download(item);
    } catch (error) {
      if (converterMissing) return;
      warn(`海报下载失败 ${item.path}：${error.message}`);
    }
  }
}));

if (converterMissing) warn("未找到 cwebp，这次没有下载海报。");

for (const [key, path] of Object.entries(index)) {
  if (!posterPath.test(path) || !await exists(fileOf(path))) delete index[key];
}

const referenced = new Set(Object.values(index).filter((path) => posterPath.test(path)).map(fileOf));
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
  const summary = `### 海报同步\n${warnings.map((item) => `- ${item}`).join("\n")}\n`;
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary).catch((error) => console.warn(error.message));
}
