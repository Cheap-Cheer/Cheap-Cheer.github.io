const datePattern = /^\d{4}(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/;

export const views = {
  movies: { name: "电影", empty: "还没有电影记录。", unit: "部电影", size: 12, kind: "movie" },
  reading: { name: "书籍", empty: "还没有书籍记录。", unit: "本书", size: 9, kind: "book" },
};

export function byNewest(a, b) {
  return b.date.localeCompare(a.date);
}

function isRecord(record) {
  return typeof record?.title === "string" && record.title.trim()
    && typeof record.date === "string" && datePattern.test(record.date)
    && Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5
    && typeof record.review === "string";
}

export async function loadRecords(key) {
  const response = await fetch(`${key}.json`);
  if (!response.ok) throw new Error("记录文件不可用");
  const { records } = await response.json();
  return records.filter(isRecord).sort(byNewest);
}

export function countByYear(records) {
  const counts = new Map();
  for (const record of records) {
    const year = record.date.slice(0, 4);
    counts.set(year, (counts.get(year) || 0) + 1);
  }
  return counts;
}
