const site = "https://cheap-cheer.github.io";

const nav = [
  ["/", "首页"],
  ["/movies.html", "电影"],
  ["/reading.html", "书籍"],
  ["/archive.html", "全部"],
  ["/about.html", "关于"],
];

const themeScript = `(function(){try{var saved=localStorage.getItem("theme");var dark=matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=saved==="light"||saved==="dark"?saved:dark?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

const themeIcon = `<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3.5A8.2 8.2 0 1 0 20.5 16 6.4 6.4 0 0 1 16 3.5Z"/></svg>`;

function escapeText(text) {
  return text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

function inlineJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function renderPage({ title, description, path, page, module, main, preloads, data }) {
  const fullTitle = `${title} · Cheap-Cheer`;
  const links = nav.map(([href, label]) => (
    `<a href="${href}"${href === path ? ' aria-current="page"' : ""}>${label}</a>`
  )).join("");
  const payload = data == null ? "" : `\n<script type="application/json" id="page-data">${inlineJson(data)}</script>`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(fullTitle)}</title>
<meta name="description" content="${escapeText(description)}">
<meta property="og:title" content="${escapeText(fullTitle)}">
<meta property="og:description" content="${escapeText(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeText(new URL(path, site).href)}">
<meta property="og:locale" content="zh_CN">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script>${themeScript}</script>
<link rel="stylesheet" href="/journal.css">
${preloads.map((href) => `<link rel="modulepreload" href="${href}">`).join("\n")}
</head>
<body>
<header><div class="wrap top">
<a class="logo" href="/" aria-label="首页">/</a>
<nav aria-label="主导航">${links}</nav>
<button class="theme-toggle" type="button" aria-label="切换深色模式" aria-pressed="false">${themeIcon}</button>
</div></header>
<main class="wrap" data-page="${page}"${module ? ` data-module="${module}"` : ""}>
${main.trim()}
</main>${payload}
<footer class="site-footer"><div class="wrap footer-bar">
<p>© 2026 Cheap-Cheer · 文字原创，评分与短评仅代表个人观点。海报由 <a href="https://www.themoviedb.org/">TMDB</a> 提供，版权归原权利人所有。 This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
<a class="footer-github" href="https://github.com/Cheap-Cheer" target="_blank" rel="noreferrer">GitHub ↗</a>
</div></footer>
<script src="/js/main.js" type="module"></script>
</body>
</html>
`;
}
