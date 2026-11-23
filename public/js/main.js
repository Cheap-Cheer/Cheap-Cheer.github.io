import { initTheme } from "./theme.js";

initTheme();

const main = document.querySelector("main");
const specifier = main.dataset.module;
if (specifier) {
  try {
    const node = document.getElementById("page-data");
    const data = node ? JSON.parse(node.textContent) : {};
    const mod = await import(specifier);
    mod.render(main, data);
  } catch {
    const status = main.querySelector("[role=status]");
    if (status) status.textContent = "暂时无法加载记录，请稍后刷新。";
    for (const target of main.querySelectorAll(".cards")) {
      if (!target.children.length) target.textContent = "暂时无法加载记录。";
    }
  }
}
