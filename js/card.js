import { element } from "./dom.js";

function dateText(date) {
  const [year, month, day] = date.split("-");
  const parts = [year];
  if (month) parts.push(month.padStart(2, "0"));
  if (day) parts.push(day.padStart(2, "0"));
  return parts.join("-");
}

function doubanLink(record, kind) {
  if (typeof record.doubanId === "string" && /^\d+$/.test(record.doubanId)) {
    return `https://${kind}.douban.com/subject/${record.doubanId}/`;
  }
  const category = kind === "movie" ? "1002" : "1001";
  return "https://www.douban.com/search?" + new URLSearchParams({ q: record.title, cat: category });
}

function posterSource(record) {
  if (typeof record.poster !== "string") return "";
  if (/^https:\/\/[^/]+\.doubanio\.com\//.test(record.poster)) return record.poster;
  if (/^posters\/[^/\\]+\.jpg$/.test(record.poster) && !record.poster.includes("..")) return record.poster;
  return "";
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

function reviewOverflows(preview) {
  const width = preview.clientWidth;
  if (!width) return false;
  const probe = preview.cloneNode(true);
  probe.hidden = false;
  probe.classList.remove("clipped");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.width = `${width}px`;
  probe.style.margin = "0";
  preview.parentElement.append(probe);
  const fullHeight = probe.getBoundingClientRect().height;
  probe.style.display = "-webkit-box";
  probe.style.webkitLineClamp = "2";
  probe.style.webkitBoxOrient = "vertical";
  probe.style.overflow = "hidden";
  const clampedHeight = probe.getBoundingClientRect().height;
  probe.remove();
  return fullHeight - clampedHeight > 1;
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
    preview.classList.toggle("clipped", !open);
  });
  body.append(preview, button);

  const update = () => {
    if (!preview.isConnected) {
      observer.disconnect();
      return;
    }
    const overflow = reviewOverflows(preview);
    const open = button.getAttribute("aria-expanded") === "true";
    if (!overflow) {
      preview.classList.remove("clipped");
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
  };
  const observer = new ResizeObserver(update);
  observer.observe(preview);
}

function appendPoster(article, record) {
  const fallback = posterSource(record);
  const source = /^\/[A-Za-z0-9]+\.jpg$/.test(record.tmdbPoster)
    ? "https://image.tmdb.org/t/p/w342" + record.tmdbPoster : fallback;
  if (!source) return;

  const cover = element("div", "cover");
  const image = element("img");
  image.alt = "";
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    if (fallback && image.getAttribute("src") !== fallback) {
      image.src = fallback;
      return;
    }
    cover.remove();
    article.classList.add("text-only");
  });
  cover.append(image);
  article.append(cover);
  article.classList.remove("text-only");
  image.src = source;
}

export function createCard(record, kind, headingLevel = 2) {
  const article = element("article", `card ${kind} text-only`);
  appendPoster(article, record);

  const heading = element(headingLevel === 3 ? "h3" : "h2");
  const link = element("a", "", record.title);
  link.href = doubanLink(record, kind);
  heading.append(link);
  if (kind === "movie" && Number.isInteger(record.releaseYear)) {
    heading.append(" ", element("span", "year", String(record.releaseYear)));
  }
  if (kind === "book" && Number.isInteger(record.publishYear)) {
    heading.append(" ", element("span", "year", String(record.publishYear)));
  }

  const date = element(record.date.length > 4 ? "time" : "span", "date", dateText(record.date));
  if (date.tagName === "TIME") date.dateTime = record.date;

  const body = element("div");
  body.append(heading);
  if (kind === "book" && typeof record.author === "string" && record.author.trim()) {
    body.append(element("p", "author", record.author.trim()));
  }
  body.append(date);
  if (kind === "movie") {
    const stars = element("span", "stars", "★".repeat(record.rating) + "☆".repeat(5 - record.rating));
    stars.setAttribute("role", "img");
    stars.setAttribute("aria-label", `评分 ${record.rating} 分，满分 5 分`);
    body.append(stars);
  }
  appendReview(body, record.review);
  article.append(body);
  return article;
}
