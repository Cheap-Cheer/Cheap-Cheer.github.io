export const views = {
  movies: { name: "电影", empty: "还没有电影记录。", unit: "部电影", size: 12, kind: "movie" },
  reading: { name: "书籍", empty: "还没有书籍记录。", unit: "本书", size: 9, kind: "book" },
};

export function byNewest(a, b) {
  return b.date.localeCompare(a.date);
}

export function countByYear(records) {
  const counts = new Map();
  for (const record of records) {
    const year = record.date.slice(0, 4);
    counts.set(year, (counts.get(year) || 0) + 1);
  }
  return counts;
}
