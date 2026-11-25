import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

const cacheDir = join(tmpdir(), "cheap-cheer-genre-pilot");
const outPath = "movie-genres.json";

function posterKey(record) {
  return JSON.stringify([record.title, record.releaseYear ?? null, record.tmdbId ?? null]);
}

function normalize(text) {
  return text.normalize("NFKC").replace(/[\p{P}\p{Z}\s]/gu, "").toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decode(text) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .trim();
}

async function fetchHtml(url) {
  const target = String(url);
  await mkdir(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, Buffer.from(target).toString("base64url"));
  try {
    return await readFile(cachePath, "utf8");
  } catch {
    // Fetch when this page is not cached yet.
  }
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await exec("curl", [
        "-fsSL",
        "-A", "Mozilla/5.0",
        "--max-time", "25",
        target,
      ], { maxBuffer: 2 * 1024 * 1024, encoding: "utf8" });
      if (!stdout.includes("<html")) throw new Error("空页面");
      if (stdout.includes("Just a moment")) throw new Error("页面被拦截");
      await writeFile(cachePath, stdout);
      await sleep(200);
      return stdout;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      await sleep(attempt * 1000);
    }
  }
  throw lastError;
}

function genresFromHtml(html) {
  const span = html.match(/<span class="genres">([\s\S]*?)<\/span>/);
  if (!span) return [];
  const names = [...span[1].matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map((match) => decode(match[1]));
  return [...new Set(names.filter((name) => name && name.length <= 20))];
}

function movieCards(html) {
  const topStart = html.indexOf("top_results_section movie");
  const movieStart = html.indexOf('id="movie_results"');
  const tvStart = html.indexOf('id="tv_results"');
  const parts = [];
  if (topStart !== -1 && movieStart > topStart) parts.push(html.slice(topStart, movieStart));
  if (movieStart !== -1) parts.push(html.slice(movieStart, tvStart === -1 ? undefined : tvStart));
  const cards = [];
  const seen = new Set();
  for (const part of parts) {
    for (const chunk of part.split("data-object-id=").slice(1)) {
      const id = Number(chunk.match(/href="\/movie\/(\d+)/)?.[1]);
      if (!Number.isInteger(id) || seen.has(id)) continue;
      const poster = chunk.match(/\/([A-Za-z0-9]+)\.jpg/)?.[1] ?? "";
      const year = Number(chunk.match(/release_date[^>]*>\s*(\d{4})/)?.[1]);
      const title = chunk.match(/<h2[^>]*>\s*<span>([^<]+)<\/span>/)?.[1] ?? "";
      if (!poster && !Number.isInteger(year)) continue;
      seen.add(id);
      cards.push({ id, poster, year, title });
    }
  }
  return cards;
}

function choose(record, cards, posterPath) {
  const wanted = posterPath?.match(/^\/([A-Za-z0-9]+)\.jpg$/)?.[1] ?? "";
  if (wanted) {
    const hits = cards.filter((card) => card.poster === wanted);
    if (hits.length === 1) return hits[0];
    const dated = hits.find((card) => card.year === record.releaseYear);
    if (dated) return dated;
  }
  if (Number.isInteger(record.releaseYear)) {
    const titled = cards.filter((card) => card.year === record.releaseYear && normalize(card.title) === normalize(record.title));
    if (titled.length) return titled[0];
    const hits = cards.filter((card) => card.year === record.releaseYear);
    if (hits.length === 1) return hits[0];
  }
  return null;
}

async function findMovie(record, posterPath) {
  if (Number.isSafeInteger(record.tmdbId) && record.tmdbId > 0) return record.tmdbId;
  const queries = [record.title];
  if (Number.isInteger(record.releaseYear)) queries.push(`${record.title} ${record.releaseYear}`);
  for (const query of queries) {
    for (const page of [1, 2]) {
      const url = new URL("https://www.themoviedb.org/search");
      url.searchParams.set("query", query);
      url.searchParams.set("language", "zh-CN");
      if (page > 1) url.searchParams.set("page", String(page));
      const hit = choose(record, movieCards(await fetchHtml(url)), posterPath);
      if (hit) return hit.id;
    }
  }
  return null;
}

function savedGenres(value) {
  if (!Array.isArray(value)) return null;
  const genres = value.filter((name) => typeof name === "string" && name.trim());
  return genres.length ? genres.map((name) => name.trim()) : null;
}

function workKey(title, year) {
  return `${title.trim()}\0${year}`;
}

const movies = JSON.parse(await readFile("movies.json", "utf8")).records;
const archiveMovies = JSON.parse(await readFile("archive.json", "utf8")).movies;
const posters = JSON.parse(await readFile("movie-posters.json", "utf8"));
const previous = await readFile(outPath, "utf8").then(JSON.parse).catch((error) => {
  if (error.code === "ENOENT") return {};
  throw error;
});
const known = new Map();
for (const [key, value] of Object.entries(previous)) {
  const genres = savedGenres(value);
  if (!genres) continue;
  let parsed;
  try {
    parsed = JSON.parse(key);
  } catch {
    continue;
  }
  if (typeof parsed?.[0] !== "string" || !Number.isInteger(parsed[1])) continue;
  const id = workKey(parsed[0], parsed[1]);
  if (!known.has(id)) known.set(id, genres);
}
const index = {};
const missed = [];
const covered = new Set();
let kept = 0;

async function fill(record, key, posterPath) {
  const label = `${record.title} (${record.releaseYear ?? ""})`;
  const exact = savedGenres(previous[key]);
  const inherited = Number.isInteger(record.releaseYear) ? known.get(workKey(record.title, record.releaseYear)) : null;
  const existing = exact || inherited;
  if (existing) {
    index[key] = existing;
    kept += 1;
    console.log(`保留：${label}：${existing.join(" / ")}`);
    return;
  }
  try {
    const id = await findMovie(record, posterPath);
    if (!id) {
      missed.push(label);
      console.warn(`未匹配：${label}`);
      return;
    }
    const html = await fetchHtml(`https://www.themoviedb.org/movie/${id}?language=zh-CN`);
    const genres = genresFromHtml(html);
    if (!genres.length) {
      missed.push(label);
      console.warn(`没有类型：${label}`);
      return;
    }
    index[key] = genres;
    if (Number.isInteger(record.releaseYear)) known.set(workKey(record.title, record.releaseYear), genres);
    console.log(`补上：${label}：${genres.join(" / ")}`);
  } catch (error) {
    missed.push(label);
    console.warn(`失败：${label}：${error.message}`);
  }
}

for (const record of movies) {
  const key = posterKey(record);
  await fill(record, key, posters[key]);
  if (Number.isInteger(record.releaseYear)) covered.add(workKey(record.title, record.releaseYear));
}
for (const item of archiveMovies) {
  const title = item.title.trim();
  if (!Number.isInteger(item.year) || covered.has(workKey(title, item.year))) continue;
  await fill({ title, releaseYear: item.year }, JSON.stringify([title, item.year, null]), null);
}

const temporary = `${outPath}.tmp`;
await writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`);
await rename(temporary, outPath);
console.log(`保留 ${kept} 部，补上 ${Object.keys(index).length - kept} 部，未匹配 ${missed.length} 部。`);
if (missed.length) process.exitCode = 1;
