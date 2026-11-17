import { element } from "./dom.js";
import { byNewest, countByYear, views } from "./records.js";
import { createCard } from "./card.js";

const sortOptions = [
  ["date", "日期从新到旧"],
  ["old", "日期从旧到新"],
  ["rating", "评分从高到低"],
];

function buildSort(onChange) {
  const sort = element("select");
  for (const [value, label] of sortOptions) {
    const option = element("option", "", label);
    option.value = value;
    sort.append(option);
  }
  sort.addEventListener("change", onChange);
  const label = element("label", "", "排序 ");
  label.append(sort);
  return { label, sort };
}

function buildYearFilters(records, onPick) {
  const filters = element("div", "filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "按记录年份筛选");

  const buttons = new Map();
  const counts = countByYear(records);
  for (const year of ["", ...counts.keys()]) {
    const label = year ? `${year}（${counts.get(year)}）` : "全部";
    const button = element("button", "", label);
    button.addEventListener("click", () => onPick(year));
    filters.append(button);
    buttons.set(year, button);
  }
  return { filters, buttons };
}

function fillPagination(pagination, pageCount, current, onPick) {
  pagination.hidden = pageCount <= 1;
  pagination.replaceChildren();
  if (pageCount <= 1) return;

  const pageButton = (label, number, isCurrent = false) => {
    const button = element("button", "", label);
    button.disabled = number < 1 || number > pageCount;
    if (isCurrent) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => {
      onPick(number);
      pagination.querySelector("[aria-current]").focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
    return button;
  };

  pagination.append(pageButton("‹ 上一页", current - 1));
  for (let number = 1; number <= pageCount; number += 1) {
    pagination.append(pageButton(String(number), number, number === current));
  }
  pagination.append(pageButton("下一页 ›", current + 1));
}

function visibleRecords(records, year, sortValue) {
  const selected = records.filter((record) => !year || record.date.startsWith(year));
  if (sortValue === "rating") selected.sort((a, b) => b.rating - a.rating || byNewest(a, b));
  if (sortValue === "old") selected.reverse();
  return selected;
}

export function renderCatalog(root, key, records) {
  const view = views[key];
  let year = "";
  let current = 1;

  const count = element("span", "count");
  count.setAttribute("aria-live", "polite");
  const heading = element("div", "page-head");
  heading.append(element("h1", "", view.name), count);

  const gridClass = key === "reading" ? "catalog book-grid" : "catalog movie-grid";
  const grid = element("div", gridClass);
  const pagination = element("nav", "pagination");
  pagination.setAttribute("aria-label", "分页");

  const edit = element("a", "edit", "在 GitHub 添加记录 ↗");
  edit.href = `https://github.com/Cheap-Cheer/Cheap-Cheer.github.io/edit/main/${key}.json`;

  const { filters, buttons } = buildYearFilters(records, (nextYear) => {
    year = nextYear;
    current = 1;
    draw();
  });
  const { label: sortLabel, sort } = buildSort(() => {
    current = 1;
    draw();
  });
  const controls = element("div", "controls");
  controls.append(filters, sortLabel);

  root.replaceChildren(heading, ...(records.length ? [controls] : []), grid, pagination, edit);

  function draw() {
    const selected = visibleRecords(records, year, sort.value);
    count.replaceChildren(element("strong", "", String(selected.length)), " " + view.unit);
    for (const [filter, button] of buttons) {
      button.setAttribute("aria-pressed", String(filter === year));
    }

    const start = (current - 1) * view.size;
    const visible = selected.slice(start, start + view.size);
    grid.replaceChildren(...(visible.length
      ? visible.map((record) => createCard(record, view.kind))
      : [element("p", "empty", view.empty)]));

    const pageCount = Math.ceil(selected.length / view.size);
    fillPagination(pagination, pageCount, current, (number) => {
      current = number;
      draw();
    });
  }

  draw();
}
