import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

// Menus are built from content/pages. Most entries lead to a page here, but a
// page can instead be marked as a link to another website, in which case it
// has no route of its own and the menu entry points straight out.
//
// Everything that draws a menu goes through here, so the header, the section
// sidebar and the route builder cannot disagree about which is which.

export interface NavItem {
  href: string;
  label: string;
  // The page id, so a menu entry can be matched to the page being viewed.
  // Absent on external links, which have no page of their own.
  id?: string;
  newTab: boolean;
  navGroup: "none" | "main" | "utility";
  parent?: string;
  order: number;
}

type Page = CollectionEntry<"pages">;

// Both are required: unticking the box in the editor must stop the page being
// a link even if the address is still sitting in the field.
export const isExternal = (page: Page) =>
  page.data.isLink && (page.data.linkUrl ?? "").trim() !== "";

// Menus are one level deep. This resolves whatever is in the parent field to a
// parent the menus can actually draw, so a page can never fall out of the
// navigation because of how it was filled in:
//
//   - the small top bar is a flat row, so a parent there is ignored
//   - a parent that is itself nested resolves to the top of its chain, rather
//     than asking for a sub drop-down that nothing renders
//   - a parent that is missing or drafted is dropped, so the page shows at top
//     level instead of disappearing
//
// The editor is set up to avoid all three, but it is the editor, not a
// guarantee. Content already on disk predates it.
function resolveParent(
  page: Page,
  byId: Map<string, Page>
): string | undefined {
  if (page.data.navGroup === "utility") return undefined;

  const seen = new Set<string>([page.id]);
  let current = page.data.parent;

  while (current && !seen.has(current)) {
    seen.add(current);
    const parent = byId.get(current);
    if (!parent) return undefined;
    if (!parent.data.parent || parent.data.navGroup === "utility") return current;
    current = parent.data.parent;
  }

  return undefined;
}

export async function navItems(): Promise<NavItem[]> {
  const pages = await getCollection("pages", (p) => !p.data.draft);
  const byId = new Map(pages.map((p) => [p.id, p]));

  return pages.map((p) => {
    const shared = {
      label: p.data.navLabel ?? p.data.title,
      navGroup: p.data.navGroup,
      parent: resolveParent(p, byId),
      order: p.data.order,
    };

    return isExternal(p)
      ? { ...shared, href: p.data.linkUrl!.trim(), newTab: true }
      : { ...shared, href: `/${p.id}/`, id: p.id, newTab: false };
  });
}

export const byOrder = (a: NavItem, b: NavItem) => a.order - b.order;
