const views = {
  movies: { name: "电影", empty: "还没有电影记录。", unit: "部电影", size: 12, kind: "movie" },
  reading: { name: "阅读", empty: "还没有阅读记录。", unit: "本书", size: 9, kind: "book" },
};
const main = document.querySelector("main");
const page = main.dataset.page;
const byNewest = (a, b) => b.date.localeCompare(a.date);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function dateText(date) {
  const [year, month, day] = date.split("-");
  if (day) return date;
  return month ? `${year}年${Number(month)}月` : `${year}年`;
}

function doubanLink(record, kind) {
  if (typeof record.doubanId === "string" && /^\d+$/.test(record.doubanId)) {
    return `https://${kind}.douban.com/subject/${record.doubanId}/`;
  }
  return "https://www.douban.com/search?" + new URLSearchParams({
    q: record.title,
    cat: kind === "movie" ? "1002" : "1001",
  });
}

function posterSource(record) {
  if (typeof record.poster !== "string") return "";
  if (/^https:\/\/[^/]+\.doubanio\.com\//.test(record.poster)) return record.poster;
  if (/^posters\/[^/\\]+\.jpg$/.test(record.poster) && !record.poster.includes("..")) return record.poster;
  return "";
}

function card(record, kind) {
  const article = element("article", `card ${kind} text-only`);
  const source = posterSource(record);
  if (source) {
    const cover = element("div", "cover");
    const image = element("img");
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      cover.remove();
      article.classList.add("text-only");
    }, { once: true });
    cover.append(image);
    article.append(cover);
    article.classList.remove("text-only");
    image.src = source;
  }

  const body = element("div");
  const heading = element("h2");
  const link = element("a", "", record.title);
  link.href = doubanLink(record, kind);
  heading.append(link);
  if (kind === "movie" && Number.isInteger(record.releaseYear)) {
    heading.append(" ", element("span", "year", String(record.releaseYear)));
  }
  const date = element(record.date.length > 4 ? "time" : "span", "date", dateText(record.date));
  if (date.tagName === "TIME") date.dateTime = record.date;
  const stars = element("span", "stars", "★".repeat(record.rating) + "☆".repeat(5 - record.rating));
  stars.setAttribute("role", "img");
  stars.setAttribute("aria-label", `评分 ${record.rating} 分，满分 5 分`);
  body.append(heading, date, stars);
  if (Array.from(record.review).length > 38) {
    const preview = element("p", "review clipped", record.review);
    preview.setAttribute("aria-hidden", "true");
    const details = element("details");
    details.append(element("summary", "", "查看完整感想"), element("p", "review", record.review));
    details.addEventListener("toggle", () => { preview.hidden = details.open; });
    body.append(preview, details);
  } else {
    body.append(element("p", "review", record.review));
  }
  article.append(body);
  return article;
}

async function load(key) {
  const response = await fetch(`${key}.json`);
  if (!response.ok) throw new Error("记录文件不可用");
  const { records } = await response.json();
  return records.filter(record =>
    typeof record?.title === "string" && record.title.trim() &&
    typeof record.date === "string" && /^\d{4}(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/.test(record.date) &&
    Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5 &&
    typeof record.review === "string"
  ).sort(byNewest);
}

async function renderHome() {
  await Promise.all(Object.entries(views).map(async ([key, view]) => {
    const target = document.querySelector(`#${key} .cards`);
    try {
      const records = await load(key);
      target.replaceChildren(...(records.length
        ? records.slice(0, 4).map(record => card(record, view.kind))
        : [element("p", "empty", view.empty)]));
    } catch {
      target.textContent = "暂时无法加载记录。";
    }
  }));
}

function renderCatalog(key, records) {
  const view = views[key];
  const heading = element("div", "page-head");
  const count = element("span", "count");
  count.setAttribute("aria-live", "polite");
  heading.append(element("h1", "", view.name), count);
  const grid = element("div", key === "reading" ? "catalog book-grid" : "catalog movie-grid");
  const pagination = element("nav", "pagination");
  pagination.setAttribute("aria-label", "分页");
  const edit = element("a", "edit", "在 GitHub 添加记录 ↗");
  edit.href = `https://github.com/Cheap-Cheer/Cheap-Cheer.github.io/edit/main/${key}.json`;
  const controls = element("div", "controls");
  const filters = element("div", "filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "按记录年份筛选");
  const sort = element("select");
  for (const [value, label] of [
    ["date", "日期从新到旧"], ["old", "日期从旧到新"], ["rating", "评分从高到低"],
  ]) {
    const option = element("option", "", label);
    option.value = value;
    sort.append(option);
  }
  const sortLabel = element("label", "", "排序 ");
  sortLabel.append(sort);
  controls.append(filters, sortLabel);
  main.replaceChildren(heading, ...(records.length ? [controls] : []), grid, pagination, edit);

  let year = "";
  let current = 1;
  const buttons = new Map();
  for (const filter of ["", ...new Set(records.map(record => record.date.slice(0, 4)))]) {
    const button = element("button", "", filter || "全部");
    button.addEventListener("click", () => { year = filter; current = 1; update(); });
    filters.append(button);
    buttons.set(filter, button);
  }
  sort.addEventListener("change", () => { current = 1; update(); });

  function update() {
    const selected = records.filter(record => !year || record.date.startsWith(year));
    if (sort.value === "rating") selected.sort((a, b) => b.rating - a.rating || byNewest(a, b));
    if (sort.value === "old") selected.reverse();
    count.replaceChildren(element("strong", "", String(selected.length)), " " + view.unit);
    for (const [filter, button] of buttons) button.setAttribute("aria-pressed", String(filter === year));
    const visible = selected.slice((current - 1) * view.size, current * view.size);
    grid.replaceChildren(...(visible.length
      ? visible.map(record => card(record, view.kind))
      : [element("p", "empty", view.empty)]));
    const pages = Math.ceil(selected.length / view.size);
    pagination.hidden = pages <= 1;
    pagination.replaceChildren();
    if (pages <= 1) return;
    const pageButton = (label, number, isCurrent = false) => {
      const button = element("button", "", label);
      button.disabled = number < 1 || number > pages;
      if (isCurrent) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => {
        current = number;
        update();
        pagination.querySelector("[aria-current]").focus({ preventScroll: true });
        window.scrollTo(0, 0);
      });
      return button;
    };
    pagination.append(pageButton("‹ 上一页", current - 1));
    for (let number = 1; number <= pages; number++) {
      pagination.append(pageButton(String(number), number, number === current));
    }
    pagination.append(pageButton("下一页 ›", current + 1));
  }
  update();
}

if (page === "home") {
  renderHome();
} else {
  load(page).then(records => renderCatalog(page, records)).catch(() => {
    main.querySelector("[role=status]").textContent = "暂时无法加载记录，请稍后刷新。";
  });
}
