import { readFile } from "node:fs/promises";
import { validate } from "./schema.mjs";

const sources = [
  ["movies.json", "schemas/movies.schema.json"],
  ["reading.json", "schemas/reading.schema.json"],
  ["archive.json", "schemas/archive.schema.json"],
];

export function yearCap(now = new Date()) {
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric" }).format(now));
  return year + 1;
}

export function checkYears({ movies, reading, archive }, cap) {
  const errors = [];
  const add = (file, path, title, year) => {
    if (!Number.isInteger(year) || (year >= 1900 && year <= cap)) return;
    errors.push({ file, path, title, message: `年份 ${year} 超出 1900–${cap}` });
  };
  movies.forEach((record, index) => {
    add("movies.json", `/records/${index}/releaseYear`, record.title, record.releaseYear);
    add("movies.json", `/records/${index}/date`, record.title, Number(String(record.date).slice(0, 4)));
  });
  reading.forEach((record, index) => {
    add("reading.json", `/records/${index}/publishYear`, record.title, record.publishYear);
    add("reading.json", `/records/${index}/date`, record.title, Number(String(record.date).slice(0, 4)));
  });
  for (const group of ["movies", "books"]) {
    archive[group].forEach((item, index) => {
      add("archive.json", `/${group}/${index}/year`, item.title, item.year);
    });
  }
  return errors;
}

export async function loadJournal() {
  const errors = [];
  const documents = {};
  for (const [file, schemaPath] of sources) {
    let data;
    try {
      data = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      errors.push({ file, path: "", title: "", message: `无法解析 JSON：${error.message}` });
      continue;
    }
    try {
      const schema = JSON.parse(await readFile(schemaPath, "utf8"));
      for (const error of validate(schema, data)) errors.push({ file, ...error });
    } catch (error) {
      errors.push({ file, path: "", title: "", message: error.message });
      continue;
    }
    documents[file] = data;
  }

  const movies = documents["movies.json"]?.records ?? [];
  const reading = documents["reading.json"]?.records ?? [];
  const archive = documents["archive.json"] ?? { movies: [], books: [] };
  if (Array.isArray(movies) && Array.isArray(reading) && Array.isArray(archive.movies) && Array.isArray(archive.books)) {
    errors.push(...checkYears({ movies, reading, archive }, yearCap()));
  }
  return { errors, movies, reading, archive };
}

export function reportErrors(errors) {
  for (const error of errors) {
    const place = `${error.path ?? ""}${error.title ? `（${error.title}）` : ""}`;
    const text = `${error.file}${place ? ` ${place}` : ""}：${error.message}`.replaceAll("\n", " ");
    console.error(text);
    if (process.env.GITHUB_ACTIONS) console.log(`::error file=${error.file}::${text}`);
  }
}

export function byNewest(a, b) {
  return b.date.localeCompare(a.date);
}

export function posterKey(record) {
  return JSON.stringify([record.title, record.releaseYear ?? null, record.tmdbId ?? null]);
}

export function posterUrl(tmdbPath) {
  return `/posters/${tmdbPath.slice(1, -4)}.webp`;
}

export function withPosters(records, index) {
  return records.map((record) => {
    const path = index[posterKey(record)];
    if (!/^\/[A-Za-z0-9]+\.jpg$/.test(path ?? "")) return record;
    return { ...record, poster: posterUrl(path) };
  });
}

export function withGenres(records, index) {
  return records.map((record) => {
    const names = index?.[posterKey(record)];
    if (!Array.isArray(names)) return record;
    const genres = names.filter((name) => typeof name === "string" && name.trim() && name.length <= 20);
    if (!genres.length) return record;
    return { ...record, genres };
  });
}

export function genreWorks(index) {
  const works = new Map();
  if (!index) return works;
  for (const [key, names] of Object.entries(index)) {
    let parsed;
    try {
      parsed = JSON.parse(key);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed) || typeof parsed[0] !== "string" || !Number.isInteger(parsed[1])) continue;
    if (!Array.isArray(names)) continue;
    const genres = names.filter((name) => typeof name === "string" && name.trim() && name.length <= 20);
    if (!genres.length) continue;
    const work = `${parsed[0].trim()}\0${parsed[1]}`;
    if (!works.has(work)) works.set(work, genres);
  }
  return works;
}

export function mergeArchive(archive, movies, reading, genreIndex) {
  const works = genreWorks(genreIndex);
  const workYear = (record, field) => (
    Number.isInteger(record[field]) ? record[field] : Number(String(record.date).slice(0, 4))
  );
  return {
    movies: merge(archive.movies, movies.map((record) => ({
      title: record.title,
      year: workYear(record, "releaseYear"),
      genres: record.genres,
    })), works),
    books: merge(archive.books, reading.map((record) => ({
      title: record.title,
      year: workYear(record, "publishYear"),
    }))),
  };
}

function merge(stored, extra, works) {
  const seen = new Map();
  const items = [];
  for (const item of [...stored, ...extra]) {
    const title = item.title.trim();
    const key = `${title}\0${item.year}`;
    const genres = Array.isArray(item.genres) && item.genres.length ? item.genres : works?.get(key);
    if (seen.has(key)) {
      const existing = items[seen.get(key)];
      if (!existing.genres && genres) existing.genres = genres;
      continue;
    }
    const next = { title, year: item.year };
    if (genres) next.genres = genres;
    seen.set(key, items.length);
    items.push(next);
  }
  return items;
}
