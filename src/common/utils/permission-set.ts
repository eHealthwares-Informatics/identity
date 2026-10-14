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
 * Only codes that are *covered* are dropped; distinct grants are all kept, so
 * nothing a user was given explicitly disappears:
 *
 *   [rxsoft.catalog, rxsoft.catalog.item.read, shop.pos]
 *     → [rxsoft.catalog, shop.pos]
 */
export function compressPermissions(codes: string[]): string[] {
  const unique = [...new Set(codes)];

  return unique.filter(
    (code) =>
      // Keep `code` unless some *other* granted code already covers it.
      !unique.some((other) => other !== code && permissionMatches(other, code))
  );
}
