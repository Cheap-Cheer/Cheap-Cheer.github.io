import { loadArchive, renderArchive } from "./archive.js";
import { renderCatalog } from "./catalog.js";
import { renderHome } from "./home.js";
import { loadRecords } from "./records.js";

const main = document.querySelector("main");
const page = main.dataset.page;

function showLoadError() {
  main.querySelector("[role=status]").textContent = "暂时无法加载记录，请稍后刷新。";
}

if (page === "home") {
  renderHome();
} else if (page === "archive") {
  loadArchive().then((archive) => renderArchive(main, archive)).catch(showLoadError);
} else {
  loadRecords(page).then((records) => renderCatalog(main, page, records)).catch(showLoadError);
}
