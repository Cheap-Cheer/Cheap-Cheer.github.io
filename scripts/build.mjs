import { access, cp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { byNewest, loadJournal, mergeArchive, reportErrors, withGenres, withPosters } from "./lib/data.mjs";
import { renderPage } from "./lib/layout.mjs";
import { preloadsFor } from "./lib/modules.mjs";

const homeLimit = 4;
const { errors, movies, reading, archive } = await loadJournal();
if (errors.length) {
  reportErrors(errors);
  process.exit(1);
}

const posterIndex = JSON.parse(await readFile("movie-posters.json", "utf8"));
const genreIndex = await readFile("movie-genres.json", "utf8").then(JSON.parse).catch((error) => {
  if (error.code === "ENOENT") return {};
  throw error;
});
const movieRecords = withGenres(withPosters([...movies].sort(byNewest), posterIndex), genreIndex);
const bookRecords = [...reading].sort(byNewest);
for (const record of movieRecords) {
  if (!record.poster) continue;
  try {
    await access(join("public", record.poster));
  } catch {
    const message = `缺少海报文件 ${record.poster}（${record.title}）`;
    console.warn(message);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning::${message}`);
  }
}
for (const path of Object.values(posterIndex)) {
  if (/^\/[A-Za-z0-9]+\.jpg$/.test(path)) continue;
  console.warn(`忽略无法使用的海报路径 ${path}`);
}

const pages = [
  {
    out: "index.html",
    title: "首页",
    description: "记录2026年以来我观看的电影和阅读的书籍。",
    path: "/",
    page: "home",
    module: "/js/home.js",
    fragment: "pages/home.html",
    data: { movies: movieRecords.slice(0, homeLimit), reading: bookRecords.slice(0, homeLimit) },
  },
  {
    out: "movies.html",
    title: "电影",
    description: "我看过的电影，按观看日期记录评分和短评。",
    path: "/movies.html",
    page: "movies",
    module: "/js/catalog.js",
    fragment: "pages/movies.html",
    data: { records: movieRecords },
  },
  {
    out: "reading.html",
    title: "书籍",
    description: "我读过的书，记下作者和短评。",
    path: "/reading.html",
    page: "reading",
    module: "/js/catalog.js",
    fragment: "pages/reading.html",
    data: { records: bookRecords },
  },
  {
    out: "archive.html",
    title: "全部",
    description: "看过的电影和书，按上映或出版年份整理。",
    path: "/archive.html",
    page: "archive",
    module: "/js/archive.js",
    fragment: "pages/archive.html",
    data: mergeArchive(archive, movieRecords, reading, genreIndex),
  },
  {
    out: "about.html",
    title: "关于",
    description: "关于我，以及电影、书籍、摄影和音乐。",
    path: "/about.html",
    page: "about",
    module: "",
    fragment: "pages/about.html",
    data: null,
  },
  {
    out: "404.html",
    title: "找不到页面",
    description: "这个地址没有内容。",
    path: "/404.html",
    page: "missing",
    module: "",
    fragment: "pages/404.html",
    data: null,
  },
];

await rm("dist", { recursive: true, force: true });
await cp("public", "dist", { recursive: true });
for (const page of pages) {
  const main = await readFile(page.fragment, "utf8");
  const html = renderPage({ ...page, main, preloads: preloadsFor(page.module) });
  await writeFile(join("dist", page.out), html);
}
