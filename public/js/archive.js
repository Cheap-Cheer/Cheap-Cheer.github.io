import { element } from "./dom.js";
import { canEdit } from "./owner.js";

const pageSize = 36;

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
    const list = groups.get(item.year) || [];
    list.push(item);
    groups.set(item.year, list);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

function decadeChoices(items) {
  const counts = new Map();
  for (const item of items) counts.set(decadeOf(item.year), (counts.get(decadeOf(item.year)) || 0) + 1);
  return [
    ["", `全部（${items.length}）`],
    ...decades.filter(([key]) => counts.has(key)).map(([key, label]) => [key, `${label}（${counts.get(key)}）`]),
  ];
}

function genreChoices(items) {
  const counts = new Map();
  for (const item of items) {
    for (const name of item.genres ?? []) counts.set(name, (counts.get(name) || 0) + 1);
  }
  const names = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b, "zh"));
  return [
    ["", `全部（${items.length}）`],
    ...names.map((name) => [name, `${name}（${counts.get(name)}）`]),
  ];
}

function buildPicker(name, onPick) {
  let current = "";
  const field = element("div", "picker-field");
  const caption = element("span", "", name);
  caption.addEventListener("click", () => button.click());
  field.append(caption, " ");
  const picker = element("span", "picker");
  const button = element("button", "picker-button");
  button.type = "button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const menu = element("div", "picker-menu");
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  picker.append(button, menu);
  field.append(picker);

  const close = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = menu.hidden;
    for (const other of document.querySelectorAll(".picker-menu")) {
      if (other === menu) continue;
      other.hidden = true;
      other.previousElementSibling?.setAttribute("aria-expanded", "false");
    }
    menu.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
  });
  document.addEventListener("click", (event) => {
    if (!field.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return {
    field,
    get value() { return current; },
    fill(options, selected) {
      current = selected;
      const chosen = options.find(([value]) => value === selected) ?? options[0];
      button.textContent = chosen?.[1] ?? "";
      menu.replaceChildren(...options.map(([value, text]) => {
        const option = element("button", "", text);
        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(value === selected));
        option.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
          if (value !== current) onPick(value);
        });
        return option;
      }));
    },
  };
}

function renderGroups(groups) {
  const list = element("div", "year-list");
  for (const [year, titles] of groups) {
    const group = element("section", "year-group");
    const heading = element("h3");
    const time = element("time", "", String(year));
    time.dateTime = String(year);
    heading.append(time);
    const names = element("ul");
    for (const item of titles) {
      const row = element("li");
      row.append(item.title);
      if (item.genres?.length) row.append(element("span", "genres", item.genres.join(" / ")));
      names.append(row);
    }
    group.append(heading, names);
    list.append(group);
  }
  return list;
}

function paginate(groups) {
  const pages = [];
  let page = [];
  let count = 0;
  for (const group of groups) {
    if (page.length && count >= pageSize) {
      pages.push(page);
      page = [];
      count = 0;
    }
    page.push(group);
    count += group[1].length;
  }
  if (page.length) pages.push(page);
  return pages;
}

function renderMovies(items) {
  const section = element("section");
  const head = element("div", "archive-head");
  const count = element("p", "count");
  head.append(element("h2", "", "电影"), count);

  const filters = element("div", "filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "筛选");
  let selected = "";
  let genre = "";
  let current = 1;
  const decadePicker = buildPicker("年代", (value) => {
    selected = value;
    current = 1;
    draw();
  });
  const genrePicker = items.some((item) => item.genres?.length)
    ? buildPicker("类型", (value) => {
      genre = value;
      current = 1;
      draw();
    })
    : null;
  filters.append(decadePicker.field, ...(genrePicker ? [genrePicker.field] : []));

  const listHost = element("div");
  const pagination = element("nav", "pagination");
  pagination.setAttribute("aria-label", "分页");
  section.append(head, items.length ? filters : element("p", "empty", "还没有记录。"), listHost, pagination);

  function fillPagination(pageCount) {
    pagination.hidden = pageCount <= 1;
    pagination.replaceChildren();
    if (pageCount <= 1) return;
    const pageButton = (label, number, isCurrent = false) => {
      const button = element("button", "", label);
      button.disabled = number < 1 || number > pageCount;
      if (isCurrent) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => {
        current = number;
        draw();
        pagination.querySelector("[aria-current]")?.focus({ preventScroll: true });
        section.scrollIntoView({ block: "start" });
      });
      return button;
    };
    pagination.append(pageButton("‹ 上一页", current - 1));
    for (let number = 1; number <= pageCount; number += 1) pagination.append(pageButton(String(number), number, number === current));
    pagination.append(pageButton("下一页 ›", current + 1));
  }

  function draw() {
    let genreItems = items.filter((item) => !genre || item.genres?.includes(genre));
    if (selected && !genreItems.some((item) => decadeOf(item.year) === selected)) selected = "";
    const decadeItems = items.filter((item) => !selected || decadeOf(item.year) === selected);
    if (genre && !decadeItems.some((item) => item.genres?.includes(genre))) {
      genre = "";
      genreItems = items;
    }
    decadePicker.fill(decadeChoices(genreItems), selected);
    genrePicker?.fill(genreChoices(decadeItems), genre);
    const visible = decadeItems.filter((item) => !genre || item.genres?.includes(genre));
    const pages = paginate(groupByYear(visible));
    if (current > pages.length) current = 1;
    count.replaceChildren(element("strong", "", String(visible.length)), " 部电影");
    const groups = pages[current - 1] ?? [];
    const empty = items.length && (selected || genre) ? "没有符合条件的电影。" : "还没有记录。";
    listHost.replaceChildren(groups.length ? renderGroups(groups) : element("p", "empty", empty));
    fillPagination(pages.length);
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
  section.append(head, items.length ? renderGroups(groupByYear(items)) : element("p", "empty", "还没有记录。"));
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
