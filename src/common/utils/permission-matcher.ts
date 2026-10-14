/**
 * Wildcard permission-code matcher — the semantics every service and the UI
 * share (identity, rxsoft, frontend). They MUST stay byte-identical, or the UI
 * will hide something the API allows (or show something it 403s).
 *
 * A user permission matches a required code when every dot-segment matches.
 * Two wildcard forms are understood:
 *
 *   - **Parent grant (preferred).** A *prefix* grant covers its whole subtree:
 *     `rxsoft.catalog` covers `rxsoft.catalog.item.read`, `…item.create`, and so
 *     on. The module/parent code IS the default wildcard — you do not append
 *     `.*`.
 *   - **Explicit `*` segments (legacy).** `rxsoft.*` covers any single-segment
 *     suffix, `rxsoft.catalog.*` covers everything under `catalog`, and a bare
 *     `*` covers everything. Kept for backward compatibility with existing
 *     grants and `permissions` rows; new grants should use the parent form.
 */
export function permissionMatches(userPerm: string, requiredCode: string): boolean {
  if (userPerm === '*') return true;

  const userParts = userPerm.split('.');
  const requiredParts = requiredCode.split('.');

  for (let i = 0; i < userParts.length; i++) {
    if (userParts[i] === '*') {
      if (i === userParts.length - 1) return true;
      continue;
    }
    if (i >= requiredParts.length) return false;
    if (userParts[i] !== requiredParts[i]) return false;
  }

  // Every granted segment matched positionally, so the grant is a prefix of the
  // required code — a parent grant covering its subtree. (Previously this
  // required equal lengths, which is why `rxsoft.catalog` could not cover
  // `rxsoft.catalog.item.read` and only the `.*` form worked.)
  return true;
}
