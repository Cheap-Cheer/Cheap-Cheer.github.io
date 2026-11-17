import { renderCatalog } from "./catalog.js";
import { renderHome } from "./home.js";
import { loadRecords } from "./records.js";

const main = document.querySelector("main");
const page = main.dataset.page;

if (page === "home") {
  renderHome();
} else {
  loadRecords(page)
    .then((records) => renderCatalog(main, page, records))
    .catch(() => {
      main.querySelector("[role=status]").textContent = "暂时无法加载记录，请稍后刷新。";
    });
}
