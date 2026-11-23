const storageKey = "theme";

function systemTheme() {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function savedTheme() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === "light" || saved === "dark" ? saved : "";
  } catch {
    return "";
  }
}

function remember(theme) {
  try {
    if (theme === systemTheme()) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, theme);
  } catch {
    // 存储不可用时，选择只对当前这次访问生效。
  }
}

export function initTheme() {
  const button = document.querySelector(".theme-toggle");
  if (!button) return;
  const media = matchMedia("(prefers-color-scheme: dark)");

  const updateButton = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", dark ? "切换浅色模式" : "切换深色模式");
  };

  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    remember(next);
    updateButton();
  });

  media.addEventListener("change", () => {
    if (savedTheme()) return;
    document.documentElement.dataset.theme = systemTheme();
    updateButton();
  });

  updateButton();
}
