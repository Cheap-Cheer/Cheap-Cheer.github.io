import { createCard } from "./card.js";
import { element } from "./dom.js";
import { canEdit } from "./owner.js";
import { byNewest, countByYear, views } from "./records.js";

const sortOptions = [
  ["date", "日期从新到旧"],
  ["old", "日期从旧到新"],
  ["rating", "评分从高到低"],
];

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

function buildSort(kind, onPick) {
  const options = kind === "book" ? sortOptions.filter(([value]) => value !== "rating") : sortOptions;
  const picker = buildPicker("排序", onPick);
  picker.field.classList.add("sort-field");
  picker.fill(options, "date");
  return picker;
}

function yearChoices(records) {
  const counts = countByYear(records);
  const years = [...counts.keys()].sort((a, b) => b.localeCompare(a));
  return [
    ["", `全部（${records.length}）`],
    ...years.map((year) => [year, `${year}（${counts.get(year)}）`]),
  ];
}

function ratingChoices(records) {
  const counts = new Map([5, 4, 3, 2, 1].map((score) => [score, 0]));
  for (const record of records) counts.set(record.rating, (counts.get(record.rating) || 0) + 1);
  return [
    ["", `全部（${records.length}）`],
    ...[5, 4, 3, 2, 1].map((score) => [String(score), `${score} 分（${counts.get(score)}）`]),
  ];
}

function genreChoices(records) {
  const counts = new Map();
  for (const record of records) {
    for (const name of record.genres ?? []) counts.set(name, (counts.get(name) || 0) + 1);
  }
  const names = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b, "zh"));
  return [
    ["", `全部（${records.length}）`],
    ...names.map((name) => [name, `${name}（${counts.get(name)}）`]),
  ];
}

function matching(records, { year = "", rating = "", genre = "" } = {}) {
  return records.filter((record) => (
    (!year || record.date.startsWith(year))
    && (!rating || record.rating === Number(rating))
    && (!genre || record.genres?.includes(genre))
  ));
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

function visibleRecords(records, year, rating, genre, sortValue) {
  const selected = matching(records, { year, rating, genre });
  if (sortValue === "rating") selected.sort((a, b) => b.rating - a.rating || byNewest(a, b));
  if (sortValue === "old") selected.reverse();
  return selected;
}

function renderCatalog(root, key, records) {
  const view = views[key];
  let year = "";
  let rating = "";
  let genre = "";
  let current = 1;

  const count = element("span", "count");
  count.setAttribute("aria-live", "polite");
  const heading = element("div", "page-head");
  heading.append(element("h1", "", view.name), count);

  const grid = element("div", key === "reading" ? "catalog book-grid" : "catalog movie-grid");
  const narrowMovies = window.matchMedia("(max-width: 31rem)");
  const pagination = element("nav", "pagination");
  pagination.setAttribute("aria-label", "分页");

  const yearPicker = key === "movies" ? buildPicker("年代", (value) => {
    year = value;
    current = 1;
    draw();
  }) : null;
  const ratingPicker = key === "movies" ? buildPicker("评分", (value) => {
    rating = value;
    current = 1;
    draw();
  }) : null;
  const genrePicker = key === "movies" && records.some((record) => record.genres?.length)
    ? buildPicker("类型", (value) => {
      genre = value;
      current = 1;
      draw();
    })
    : null;
  const { filters, buttons } = yearPicker ? { filters: null, buttons: new Map() } : buildYearFilters(records, (nextYear) => {
    year = nextYear;
    current = 1;
    draw();
  });
  const sort = buildSort(view.kind, () => {
    current = 1;
    draw();
  });
  const controls = element("div", "controls");
  if (yearPicker) {
    const picks = element("div", "filters");
    picks.setAttribute("role", "group");
    picks.setAttribute("aria-label", "筛选");
    picks.append(yearPicker.field, ratingPicker.field, ...(genrePicker ? [genrePicker.field] : []));
    controls.append(picks);
  }
  controls.append(...[filters, sort.field].filter(Boolean));

  const children = [heading, ...(records.length ? [controls] : []), grid, pagination];
  if (canEdit()) {
    const edit = element("a", "edit", "在 GitHub 添加记录 ↗");
    edit.href = `https://github.com/Cheap-Cheer/Cheap-Cheer.github.io/edit/main/${key}.json`;
    children.push(edit);
  }
  root.replaceChildren(...children);

  function draw() {
    if (yearPicker) {
      yearPicker.fill(yearChoices(matching(records, { rating, genre })), year);
      ratingPicker.fill(ratingChoices(matching(records, { year, genre })), rating);
      genrePicker?.fill(genreChoices(matching(records, { year, rating })), genre);
    }
    const selected = visibleRecords(records, year, rating, genre, sort.value);
    count.replaceChildren(element("strong", "", String(selected.length)), ` ${view.unit}`);
    for (const [filter, button] of buttons) {
      button.setAttribute("aria-pressed", String(filter === year));
    }

    const start = (current - 1) * view.size;
    const visible = selected.slice(start, start + view.size);
    const empty = records.length && (year || rating || genre)
      ? `没有符合条件的${view.kind === "book" ? "书" : "电影"}。`
      : view.empty;
    const cards = visible.length
      ? visible.map((record) => createCard(record, view.kind))
      : [element("p", "empty", empty)];
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
