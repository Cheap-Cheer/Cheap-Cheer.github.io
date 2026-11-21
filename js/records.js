const datePattern = /^\d{4}(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/;

export const views = {
  movies: { name: "电影", empty: "还没有电影记录。", unit: "部电影", size: 12, kind: "movie" },
  reading: { name: "书籍", empty: "还没有书籍记录。", unit: "本书", size: 9, kind: "book" },
};

export function byNewest(a, b) {
  return b.date.localeCompare(a.date);
}

function isRecord(record, key) {
  const readable = typeof record?.title === "string" && record.title.trim()
    && typeof record.date === "string" && datePattern.test(record.date)
    && typeof record.review === "string";
  if (!readable) return false;
  if (key === "reading") return true;
  return Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5;
}

export async function loadRecords(key) {
  const response = await fetch(`${key}.json`);
  if (!response.ok) throw new Error("记录文件不可用");
  const { records } = await response.json();
  if (key === "movies") {
    // Actions commits do not trigger a branch-based Pages rebuild. Read the published index directly.
    const indexUrl = location.hostname === "cheap-cheer.github.io"
      ? "https://raw.githubusercontent.com/cheap-cheer/cheap-cheer.github.io/main/movie-posters.json"
      : "movie-posters.json";
    const index = await fetch(indexUrl, { signal: AbortSignal.timeout(3000) }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
    for (const record of records) {
      if (record) record.tmdbPoster = index[JSON.stringify([record.title, record.releaseYear ?? null, record.tmdbId ?? null])];
    }
  }
  return records.filter((record) => isRecord(record, key)).sort(byNewest);
}

export function countByYear(records) {
  const counts = new Map();
  for (const record of records) {
    const year = record.date.slice(0, 4);
    counts.set(year, (counts.get(year) || 0) + 1);
  }
  return counts;
}
