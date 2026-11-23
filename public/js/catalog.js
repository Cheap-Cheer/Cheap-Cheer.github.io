import { createCard } from "./card.js";
import { element } from "./dom.js";
import { canEdit } from "./owner.js";
import { byNewest, countByYear, views } from "./records.js";

const sortOptions = [
  ["date", "日期从新到旧"],
  ["old", "日期从旧到新"],
  ["rating", "评分从高到低"],
];

function buildSort(kind, onChange) {
  const sort = element("select");
  const options = kind === "book" ? sortOptions.filter(([value]) => value !== "rating") : sortOptions;
  for (const [value, label] of options) {
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

function placeCards(grid, cards, split) {
  if (!split || !cards.length || cards[0].tagName !== "ARTICLE") {
    grid.replaceChildren(...cards);
    return;
  }
  const columns = [element("div", "movie-col"), element("div", "movie-col")];
  cards.forEach((card, index) => columns[index % 2].append(card));
  grid.replaceChildren(...columns);
}

function visibleRecords(records, year, sortValue) {
  const selected = records.filter((record) => !year || record.date.startsWith(year));
  if (sortValue === "rating") selected.sort((a, b) => b.rating - a.rating || byNewest(a, b));
  if (sortValue === "old") selected.reverse();
  return selected;
}

function renderCatalog(root, key, records) {
  const view = views[key];
  let year = "";
  let current = 1;

  const count = element("span", "count");
  count.setAttribute("aria-live", "polite");
  const heading = element("div", "page-head");
  heading.append(element("h1", "", view.name), count);

  const grid = element("div", key === "reading" ? "catalog book-grid" : "catalog movie-grid");
  const narrowMovies = window.matchMedia("(max-width: 31rem)");
  const pagination = element("nav", "pagination");
  pagination.setAttribute("aria-label", "分页");

  const showYears = countByYear(records).size > 1;
  const { filters, buttons } = showYears
    ? buildYearFilters(records, (nextYear) => {
      year = nextYear;
      current = 1;
      draw();
    })
    : { filters: null, buttons: new Map() };
  const { label: sortLabel, sort } = buildSort(view.kind, () => {
    current = 1;
    draw();
  });
  const controls = element("div", "controls");
  controls.append(...[filters, sortLabel].filter(Boolean));

  const children = [heading, ...(records.length ? [controls] : []), grid, pagination];
  if (canEdit()) {
    const edit = element("a", "edit", "在 GitHub 添加记录 ↗");
    edit.href = `https://github.com/Cheap-Cheer/Cheap-Cheer.github.io/edit/main/${key}.json`;
    children.push(edit);
  }
  root.replaceChildren(...children);

  function draw() {
    const selected = visibleRecords(records, year, sort.value);
    count.replaceChildren(element("strong", "", String(selected.length)), ` ${view.unit}`);
    for (const [filter, button] of buttons) {
      button.setAttribute("aria-pressed", String(filter === year));
    }

    const start = (current - 1) * view.size;
    const visible = selected.slice(start, start + view.size);
    const cards = visible.length
      ? visible.map((record) => createCard(record, view.kind))
      : [element("p", "empty", view.empty)];
    placeCards(grid, cards, key === "movies" && !narrowMovies.matches);

    const pageCount = Math.ceil(selected.length / view.size);
    fillPagination(pagination, pageCount, current, (number) => {
      current = number;
      draw();
    });
  }

  if (key === "movies") narrowMovies.addEventListener("change", draw);
  draw();
}

export function render(root, data) {
  renderCatalog(root, root.dataset.page, data.records);
}
