// Docs pages come from the main checkout, so a sidebar entry can point at a page that checkout
// does not have yet. Dropping the entry keeps the build green; check-dist still reports a page
// that is built without an entry.
export function presentPages(items, hasPage) {
  return items.flatMap((item) => {
    if (item.items) {
      const items = presentPages(item.items, hasPage);
      return items.length ? [{ ...item, items }] : [];
    }
    return !item.slug || hasPage(item.slug) ? [item] : [];
  });
}

// Starlight expands every group unless told otherwise; the current page's ancestors open regardless.
export const collapseGroups = (items) =>
  items.map((item) => (item.items ? { ...item, collapsed: true, items: collapseGroups(item.items) } : item));
