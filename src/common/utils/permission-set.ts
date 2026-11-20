import { permissionMatches } from './permission-matcher';

/**
 * Collapses a permission set to its minimal form.
 *
 * Because a parent code covers its whole subtree, any granted code that is
 * already covered by a *broader* granted code is redundant — `rxsoft.catalog`
 * makes `rxsoft.catalog.item.read` (and every sibling) redundant, and `*` makes
 * everything redundant. Returning only the broad grants keeps `/auth/me`
 * (and the JWT that carries it) small, and the UI still gates every child
 * correctly because the matcher understands parent grants.
 *
 * Dedup is greedy over a broadest-first ordering. This matters because some
 * grants cover each other *mutually*: a parent and its legacy explicit wildcard
 * (`rxsoft` ↔ `rxsoft.*`) each match the other. A naive "drop anything covered
 * by some other code" filter therefore removes BOTH and can empty a user's
 * entire permission set (rxsoft-qa: admin logged in with no permissions and an
 * endlessly loading module switcher). Keeping the first (broadest) code and
 * only dropping codes an already-kept code covers always leaves a
 * representative — `[rxsoft, rxsoft.*]` → `[rxsoft]`, never `[]`.
 *
 * Only codes that are *covered* are dropped; distinct grants are all kept, so
 * nothing a user was given explicitly disappears:
 *
 *   [rxsoft.catalog, rxsoft.catalog.item.read, shop.pos]
 *     → [rxsoft.catalog, shop.pos]
 */
export function compressPermissions(codes: string[]): string[] {
  const unique = [...new Set(codes)];

  // Broadest first: fewer segments (prefix grants) before deeper codes, and an
  // explicit `*` segment before a concrete sibling at the same depth.
  const broadestFirst = [...unique].sort((a, b) => {
    const depth = a.split('.').length - b.split('.').length;
    if (depth !== 0) return depth;
    const aWild = a.includes('*');
    const bWild = b.includes('*');
    if (aWild !== bWild) return aWild ? -1 : 1;
    return a.localeCompare(b);
  });

  const kept = new Set<string>();
  for (const code of broadestFirst) {
    // Keep unless an already-kept (broader) grant covers it.
    if (![...kept].some((other) => permissionMatches(other, code))) {
      kept.add(code);
    }
  }

  // Preserve the caller's original ordering for a stable token/profile payload.
  return unique.filter((code) => kept.has(code));
}
