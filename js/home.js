import { element } from "./dom.js";
import { createCard } from "./card.js";
import { loadRecords, views } from "./records.js";

const homeLimit = 4;

export async function renderHome() {
  await Promise.all(Object.entries(views).map(async ([key, view]) => {
    const target = document.querySelector(`#${key} .cards`);
    try {
      const records = await loadRecords(key);
      const cards = records.slice(0, homeLimit).map((record) => createCard(record, view.kind, 3));
      target.replaceChildren(...(cards.length ? cards : [element("p", "empty", view.empty)]));
    } catch {
      target.textContent = "暂时无法加载记录。";
    }
  }));
}
