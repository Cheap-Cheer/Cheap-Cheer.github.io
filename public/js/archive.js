import { element } from "./dom.js";
import { canEdit } from "./owner.js";

const decades = [
  ["2020", "2020 年代"],
  ["2010", "2010 年代"],
  ["2000", "2000 年代"],
  ["1990", "1990 年代"],
  ["earlier", "更早"],
];

function decadeOf(year) {
  if (year >= 2020) return "2020";
  if (year >= 2010) return "2010";
  if (year >= 2000) return "2000";
  if (year >= 1990) return "1990";
  return "earlier";
}

function groupByYear(items) {
  const groups = new Map();
  for (const item of items) {
    const titles = groups.get(item.year) || [];
    titles.push(item.title);
    groups.set(item.year, titles);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

function renderNames(items) {
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
  return list;
}

function renderMovies(items) {
  const section = element("section");
  const head = element("div", "archive-head");
  const count = element("p", "count");
  head.append(element("h2", "", "电影"), count);

  const present = new Map();
  for (const item of items) present.set(decadeOf(item.year), (present.get(decadeOf(item.year)) || 0) + 1);
  const filters = element("div", "filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "按年代筛选");
  const buttons = new Map();
  let selected = decades.find(([key]) => present.has(key))?.[0] ?? "";
  for (const [key, label] of [...decades.filter(([key]) => present.has(key)), ["", "全部"]]) {
    const total = key ? present.get(key) : items.length;
    const button = element("button", "", `${label}（${total}）`);
    button.addEventListener("click", () => {
      selected = key;
      draw();
    });
    filters.append(button);
    buttons.set(key, button);
  }

  const listHost = element("div");
  section.append(head, items.length ? filters : element("p", "empty", "还没有记录。"), listHost);

  function draw() {
    const visible = selected ? items.filter((item) => decadeOf(item.year) === selected) : items;
    count.replaceChildren(element("strong", "", String(visible.length)), " 部电影");
    for (const [key, button] of buttons) button.setAttribute("aria-pressed", String(key === selected));
    listHost.replaceChildren(visible.length ? renderNames(visible) : element("p", "empty", "还没有记录。"));
  }

  if (items.length) draw();
  else count.replaceChildren(element("strong", "", "0"), " 部电影");
  return section;
}

function renderBooks(items) {
  const section = element("section");
  const head = element("div", "archive-head");
  const count = element("p", "count");
  count.append(element("strong", "", String(items.length)), " 本书");
  head.append(element("h2", "", "书籍"), count);
  section.append(head, items.length ? renderNames(items) : element("p", "empty", "还没有记录。"));
  return section;
}

export function render(root, data) {
  const note = element("p", "archive-note", "看过的电影和书，按上映时间排序，纯记录，一时半会儿想不起来那么多，持续更新中。");
  const columns = element("div", "archive");
  columns.append(renderMovies(data.movies), renderBooks(data.books));
  const children = [element("h1", "", "全部"), note, columns];
  if (canEdit()) {
    const edit = element("a", "edit", "在 GitHub 添加记录 ↗");
    edit.href = "https://github.com/Cheap-Cheer/Cheap-Cheer.github.io/edit/main/archive.json";
    children.push(edit);
  }
  root.replaceChildren(...children);
}
