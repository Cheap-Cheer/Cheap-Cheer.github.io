import { element } from "./dom.js";

function doubanLink(record, kind) {
  if (typeof record.doubanId === "string" && /^\d+$/.test(record.doubanId)) {
    return `https://${kind}.douban.com/subject/${record.doubanId}/`;
  }
  const category = kind === "movie" ? "1002" : "1001";
  return `https://www.douban.com/search?${new URLSearchParams({ q: record.title, cat: category })}`;
}

function chevron() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M6 9l6 6 6-6");
  svg.append(path);
  return svg;
}

function lineHeightOf(preview) {
  const lineHeight = Number.parseFloat(getComputedStyle(preview).lineHeight);
  return Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 0;
}

function expandedHeight(preview) {
  const probe = preview.cloneNode(true);
  probe.classList.remove("clipped");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.display = "block";
  probe.style.height = "auto";
  probe.style.margin = "0";
  probe.style.webkitLineClamp = "unset";
  probe.style.lineClamp = "unset";
  probe.style.width = `${preview.clientWidth}px`;
  preview.parentElement.append(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

function reviewLayout(preview) {
  const lineHeight = lineHeightOf(preview);
  if (!preview.clientWidth || !lineHeight) return { clip: false, lines: 2 };
  const full = expandedHeight(preview);
  const cover = preview.closest(".card")?.querySelector(".cover");
  if (!cover) return { clip: full > lineHeight * 2 + 1, lines: 2 };
  const room = cover.getBoundingClientRect().bottom - preview.getBoundingClientRect().top;
  if (full <= room + 1) return { clip: false, lines: 2 };
  const lines = Math.max(2, Math.floor(room / lineHeight));
  return { clip: full > lines * lineHeight + 1, lines };
}

function setClamp(preview, lines) {
  preview.style.webkitLineClamp = lines ? String(lines) : "";
  preview.style.lineClamp = lines ? String(lines) : "";
}

const narrowMovies = window.matchMedia("(max-width: 31rem)");

function inMovieCatalog(preview) {
  return Boolean(preview.closest(".catalog.movie-grid"));
}

function showFullMovieReview(preview) {
  return inMovieCatalog(preview) && !narrowMovies.matches;
}

function appendReview(body, review) {
  const preview = element("p", "review clipped", review);
  const button = element("button", "review-more is-off");
  button.type = "button";
  button.tabIndex = -1;
  button.setAttribute("aria-hidden", "true");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "展开感想");
  button.append(chevron());
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "收起感想" : "展开感想");
    update();
  });
  const row = element("div", "review-row");
  row.append(preview, button);
  body.append(row);

  const update = () => {
    if (!preview.isConnected) {
      observer.disconnect();
      return;
    }
    if (showFullMovieReview(preview)) {
      preview.classList.remove("clipped");
      setClamp(preview, 0);
      button.classList.add("is-off");
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "展开感想");
      return;
    }
    const { clip, lines } = reviewLayout(preview);
    const open = button.getAttribute("aria-expanded") === "true";
    if (!clip) {
      preview.classList.remove("clipped");
      setClamp(preview, 0);
      button.classList.add("is-off");
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "展开感想");
      return;
    }
    button.classList.remove("is-off");
    button.tabIndex = 0;
    button.removeAttribute("aria-hidden");
    preview.classList.toggle("clipped", !open);
    setClamp(preview, open ? 0 : lines);
  };
  const observer = new ResizeObserver(update);
  observer.observe(preview);
  const card = preview.closest(".card");
  if (card) observer.observe(card);
}

function appendPoster(article, record) {
  if (typeof record.poster !== "string" || !/^\/posters\/[A-Za-z0-9]+\.webp$/.test(record.poster)) return;
  const cover = element("div", "cover");
  const image = element("img");
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => {
    cover.remove();
    article.classList.add("text-only");
  });
  cover.append(image);
  article.append(cover);
  article.classList.remove("text-only");
  image.src = record.poster;
}

export function createCard(record, kind, headingLevel = 2) {
  const article = element("article", `card ${kind} text-only`);
  appendPoster(article, record);

  const heading = element(headingLevel === 3 ? "h3" : "h2");
  const link = element("a", "", record.title);
  link.href = doubanLink(record, kind);
  const workYear = kind === "movie" ? record.releaseYear : record.publishYear;
  const year = Number.isInteger(workYear) ? element("span", "year", String(workYear)) : null;
  if (kind === "movie") {
    const name = element("span", "work-name");
    name.append(link);
    if (Array.isArray(record.genres) && record.genres.length) {
      name.append(element("span", "genres", record.genres.join(" / ")));
    }
    heading.append(name);
    if (year) heading.append(year);
  } else {
    heading.append(link);
    if (year) heading.append(" ", year);
  }

  const date = element(record.date.length > 4 ? "time" : "span", "date", record.date);
  if (date.tagName === "TIME") date.dateTime = record.date;

  const body = element("div");
  body.append(heading);
  if (kind === "book" && typeof record.author === "string" && record.author.trim()) {
    body.append(element("p", "author", record.author.trim()));
  }
  if (kind === "movie") {
    const stars = element("span", "stars", "★".repeat(record.rating) + "☆".repeat(5 - record.rating));
    stars.setAttribute("role", "img");
    stars.setAttribute("aria-label", `评分 ${record.rating} 分，满分 5 分`);
    const meta = element("div", "meta");
    meta.append(stars, date);
    body.append(meta);
  } else {
    body.append(date);
  }
  appendReview(body, record.review);
  article.append(body);
  return article;
}
