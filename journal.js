const { source, dateLabel, reviewLabel, empty } = document.body.dataset;
const statusMessage = document.querySelector("#journal-status");
const list = document.querySelector("#journal-records");

function renderRecord({ title, date, rating, review }) {
  const item = document.createElement("li");
  const article = document.createElement("article");
  const heading = document.createElement("h3");
  heading.textContent = title;

  const metadata = document.createElement("p");
  metadata.className = "metadata";
  const dateField = document.createElement("span");
  const time = document.createElement("time");
  time.dateTime = date;
  time.textContent = date;
  dateField.append(dateLabel + " ", time);

  const stars = document.createElement("span");
  stars.className = "stars";
  stars.setAttribute("role", "img");
  stars.setAttribute("aria-label", `评分 ${rating} 分，满分 5 分`);
  stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
  metadata.append(dateField, stars);

  const reviewHeading = document.createElement("h4");
  reviewHeading.textContent = reviewLabel;
  const reviewText = document.createElement("p");
  reviewText.className = "review";
  reviewText.textContent = review;
  article.append(heading, metadata, reviewHeading, reviewText);
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
      typeof record.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
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
