import { readFile, writeFile } from 'node:fs/promises';

const token = process.env.TMDB_READ_ACCESS_TOKEN;
if (!token) throw new Error('Configure the TMDB_READ_ACCESS_TOKEN Actions secret.');
const records = JSON.parse(await readFile('movies.json', 'utf8')).records;
const previous = JSON.parse(await readFile('movie-posters.json', 'utf8'));
const index = Object.create(null);
const normalize = text => text.normalize('NFKC').replace(/[\p{P}\p{Z}\s]/gu, '').toLowerCase();
async function request(path, params = {}) {
  const url = new URL('https://api.themoviedb.org/3/' + path);
  url.search = new URLSearchParams({ language: 'zh-CN', ...params });
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
  return response.json();
}
for (const record of records) {
  const { title, releaseYear, tmdbId } = record;
  const key = JSON.stringify([title, releaseYear ?? null, tmdbId ?? null]);
  if (previous[key] || index[key]) { index[key] = previous[key] || index[key]; continue; }
  let movie;
  if (Number.isSafeInteger(tmdbId) && tmdbId > 0) movie = await request(`movie/${tmdbId}`);
  else if (Number.isInteger(releaseYear)) {
    const result = await request('search/movie', { query: title, primary_release_year: String(releaseYear) });
    const matches = result.results.filter(m => Number(m.release_date?.slice(0, 4)) === releaseYear && [m.title, m.original_title].some(t => t && normalize(t) === normalize(title)));
    if (result.total_pages === 1 && matches.length === 1) movie = matches[0];
  }
  if (/^\/[A-Za-z0-9]+\.jpg$/.test(movie?.poster_path)) index[key] = movie.poster_path;
  else console.warn(`未匹配海报：${title} (${releaseYear ?? ''})，可填写 tmdbId`);
}
await writeFile('movie-posters.json', JSON.stringify(index, null, 2) + '\n');
