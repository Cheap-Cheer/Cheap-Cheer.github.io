import { element } from "./dom.js";

const earliestYear = 1900;
const beforeYear = 2026;

function isItem(item) {
  return typeof item?.title === "string" && item.title.trim()
    && Number.isInteger(item.year)
    && item.year >= earliestYear
    && item.year < beforeYear;
}

function itemsOf(value) {
  return Array.isArray(value) ? value.filter(isItem) : [];
}

export async function loadArchive() {
  const response = await fetch("archive.json");
  if (!response.ok) throw new Error("记录文件不可用");
  const data = await response.json();
  return { movies: itemsOf(data.movies), books: itemsOf(data.books) };
}

function groupByYear(items) {
  const groups = new Map();
  for (const item of items) {
    const titles = groups.get(item.year) || [];
    titles.push(item.title.trim());
    groups.set(item.year, titles);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

function renderColumn(name, items, unit) {
  const section = element("section");
  const head = element("div", "archive-head");
  const count = element("p", "count");
  count.append(element("strong", "", String(items.length)), " " + unit);
  head.append(element("h2", "", name), count);

  if (!items.length) {
    section.append(head, element("p", "empty", "还没有记录。"));
    return section;
  }

  const list = element("div", "year-list");
  for (const [year, titles] of groupByYear(items)) {
    const group = element("section", "year-group");
    const heading = element("h3");
    const time = element("time", "", String(year));
    time.dateTime = String(year);
    heading.append(time);
    const names = element("ul");
    for (const title of titles) names.append(element("li", "", title));
    group.append(heading, names);
    list.append(group);
  }
  section.append(head, list);
  return section;
}

export function renderArchive(root, archive) {
  const note = element("p", "archive-note", "2026 年以前看过的电影和书，按上映时间排序，纯记录，一时半会儿想不起来那么多，持续更新中。");
  const columns = element("div", "archive");
  columns.append(
    renderColumn("电影", archive.movies, "部电影"),
    renderColumn("书籍", archive.books, "本书"),
  );
  const edit = element("a", "edit", "在 GitHub 添加记录 ↗");
  edit.href = "https://github.com/Cheap-Cheer/Cheap-Cheer.github.io/edit/main/archive.json";
  root.replaceChildren(element("h1", "", "往年已看"), note, columns, edit);
}
