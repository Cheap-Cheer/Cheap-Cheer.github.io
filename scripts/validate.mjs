import { loadJournal, reportErrors } from "./lib/data.mjs";

const { errors } = await loadJournal();
if (errors.length) {
  reportErrors(errors);
  process.exit(1);
}
