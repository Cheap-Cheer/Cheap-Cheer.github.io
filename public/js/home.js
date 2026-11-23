import { createCard } from "./card.js";
import { element } from "./dom.js";
import { views } from "./records.js";

export function render(root, data) {
  for (const [key, view] of Object.entries(views)) {
    const target = root.querySelector(`#${key} .cards`);
    const records = data[key] ?? [];
    const cards = records.map((record) => createCard(record, view.kind, 3));
    target.replaceChildren(...(cards.length ? cards : [element("p", "empty", view.empty)]));
  }
}
