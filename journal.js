const { source, dateLabel, reviewLabel, empty, doubanKind } = document.body.dataset;
const statusMessage = document.querySelector("#journal-status");
const list = document.querySelector("#journal-records");

function renderRecord({ title, date, rating, review, doubanId, releaseYear }) {
  const item = document.createElement("li");
  const article = document.createElement("article");
  const heading = document.createElement("h3");
  const link = document.createElement("a");
  link.textContent = title;

  if (typeof doubanId === "string" && /^[0-9]+$/.test(doubanId)) {
    link.href = `https://${doubanKind}.douban.com/subject/${doubanId}/`;
  } else {
    const category = doubanKind === "movie" ? "1002" : "1001";
    const query = new URLSearchParams({ q: title, cat: category });
    link.href = `https://www.douban.com/search?${query}`;
  }
  heading.append(link);
  if (doubanKind === "movie" && Number.isInteger(releaseYear)) {
    const yearLabel = document.createElement("span");
    yearLabel.className = "release-year";
    yearLabel.textContent = `（${releaseYear}）`;
    heading.append(yearLabel);
  }

  const metadata = document.createElement("p");
  metadata.className = "metadata";
  const dateField = document.createElement("span");
  const [year, month, day] = date.split("-");
  const time = document.createElement(month ? "time" : "span");
  if (month) time.dateTime = date;
  time.textContent = year + "年";
  if (month) time.textContent = `${year}年${Number(month)}月`;
  if (day) time.textContent = date;
  if (dateLabel) dateField.append(dateLabel + " ");
  dateField.append(time);

  const stars = document.createElement("span");
  stars.className = "stars";
  stars.setAttribute("role", "img");
  stars.setAttribute("aria-label", `评分 ${rating} 分，满分 5 分`);
  stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
  metadata.append(dateField, stars);

  article.append(heading, metadata);
  if (reviewLabel) {
    const reviewHeading = document.createElement("h4");
    reviewHeading.textContent = reviewLabel;
    article.append(reviewHeading);
  }
  const reviewText = document.createElement("p");
  reviewText.className = "review";
  reviewText.textContent = review;
  article.append(reviewText);
  item.append(article);
  return item;
}

async function loadRecords() {
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error("Records unavailable");

    const { records } = await response.json();
    const valid = records.filter((record) =>
      typeof record?.title === "string" && record.title.trim() &&
      typeof record.date === "string" && /^\d{4}(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/.test(record.date) &&
      Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5 &&
      typeof record.review === "string"
    );
    valid.sort((first, second) => second.date.localeCompare(first.date));
    list.replaceChildren(...valid.map(renderRecord));
    statusMessage.textContent = valid.length < records.length
      ? "有记录的格式不正确，请检查 GitHub 上的记录文件。"
      : valid.length === 0 ? empty : "";
    statusMessage.hidden = !statusMessage.textContent;
  } catch {
    statusMessage.textContent = "暂时无法加载记录，请稍后刷新。";
  }
}

loadRecords();
