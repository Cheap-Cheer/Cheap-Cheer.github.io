import { element } from "./dom.js";

function dateText(date) {
  const [year, month, day] = date.split("-");
  if (day) return date;
  if (month) return `${year}年${Number(month)}月`;
  return `${year}年`;
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

function reviewLength(review) {
  return Array.from(review).length;
}

function appendReview(body, review) {
  if (reviewLength(review) <= 38) {
    body.append(element("p", "review", review));
    return;
  }

  const preview = element("p", "review clipped", review);
  preview.setAttribute("aria-hidden", "true");
  const details = element("details");
  details.append(element("summary", "", "查看完整感想"), element("p", "review", review));
  details.addEventListener("toggle", () => {
    preview.hidden = details.open;
  });
  body.append(preview, details);
}

function appendPoster(article, record) {
  const source = posterSource(record);
  if (!source) return;

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

export function createCard(record, kind) {
  const article = element("article", `card ${kind} text-only`);
  appendPoster(article, record);

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

  const body = element("div");
  body.append(heading, date, stars);
  appendReview(body, record.review);
  article.append(body);
  return article;
}
