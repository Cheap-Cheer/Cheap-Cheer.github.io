const storageKey = "journal-edit";

export function canEdit() {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const edit = new URLSearchParams(location.search).get("edit");
  try {
    if (edit === "1") localStorage.setItem(storageKey, "1");
    if (edit === "0") localStorage.removeItem(storageKey);
    return local || localStorage.getItem(storageKey) === "1";
  } catch {
    return local;
  }
}
