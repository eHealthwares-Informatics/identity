import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODULE_PERMISSIONS } from '../modules/roles/services/permission-definitions.data';
import { permissionMatches } from '../common/utils/permission-matcher';

/**
 * Catalog coverage check (rxsoft-qa#798).
 *
 * The permission catalog is a hand-maintained claim about the services — nothing
 * derives it from them, and no service declares its codes yet (`@Permissions(`
 * appears zero times across rxsoft/identity/emr/lims). So the catalog can drift
 * silently, and a grant for a code the catalog omits can never be resolved.
 *
 * This walks the places that *reference* permission codes and asserts each one
 * is covered by the catalog — directly, or by a catalog parent (a parent grant
 * covers its subtree, so `rxsoft.catalog.*` is covered by `rxsoft.catalog`).
 *
 * Run:  npm run check:catalog
 * Exits 1 on any uncovered reference, so it can gate CI.
 *
 * Reference files live in sibling repos, so a missing file is reported as
 * SKIPPED rather than failing — identity alone cannot verify a repo that isn't
 * checked out next to it.
 */

type ReferenceSource = {
  name: string;
  /** Path relative to the monorepo root (the directory holding the repos). */
  path: string;
  /** Only literals under these namespaces are considered permission codes. */
  namespaces: string[];
};

const REFERENCE_SOURCES: ReferenceSource[] = [
  {
    name: 'frontend sidebar (ui#145 ACL tags)',
    path: 'frontend/src/layout/data/sidebar-data.ts',
    namespaces: ['rxsoft', 'shop', 'identity', 'admin', 'lis', 'emr', 'conversation', 'communication'],
  },
  {
    name: 'seed org template (role grants)',
    path: 'seed/src/provision/org-template.ts',
    namespaces: ['rxsoft', 'shop', 'identity', 'admin', 'lis', 'emr', 'conversation', 'communication'],
  },
  {
    // Identity has its own provisioner and its own copy of the template. They
    // are deliberate duplicates, so they drift — this one still had the 18 `.*`
    // grants after the seed copy moved to parent grants, which would have
    // regressed rxsoft-qa#798 for anyone provisioned through identity.
    name: 'identity provision template (role grants)',
    path: 'identity/src/modules/provision/org-template.ts',
    namespaces: ['rxsoft', 'shop', 'identity', 'admin', 'lis', 'emr', 'conversation', 'communication'],
  },
];

/**
 * The directory holding the sibling repos. Defaults to this repo's parent
 * (`…/rxsoft/identity` → `…/rxsoft`), overridable for worktrees/CI where the
 * siblings live elsewhere.
 */
function monorepoRoot(): string {
  return process.env.CATALOG_MONOREPO_ROOT ?? resolve(__dirname, '../../..');
}

function catalogCodes(): string[] {
  return MODULE_PERMISSIONS.flatMap((module) => module.permissions.map((p) => p.code));
}

/** Every quoted dotted literal under a known namespace in the file. */
function extractCodes(source: string, namespaces: string[]): Set<string> {
  const codes = new Set<string>();
  // Require at least one dot-segment: a bare `'admin'` / `'identity'` literal is
  // a role code or module id, not a permission code.
  const pattern = new RegExp(`'((?:${namespaces.join('|')})(?:\\.[a-z0-9_*-]+)+)'`, 'g');

  for (const match of source.matchAll(pattern)) {
    codes.add(match[1]);
  }
  return codes;
}

/** A reference is covered when the catalog lists it, or a catalog code covers it. */
function isCovered(reference: string, catalog: string[]): boolean {
  if (catalog.includes(reference)) return true;
  // `rxsoft.catalog.*` → `rxsoft.catalog` covers it via the matcher.
  return catalog.some((code) => permissionMatches(code, reference.replace(/\.\*$/, '')));
}

function main(): void {
  const catalog = catalogCodes();
  const root = monorepoRoot();

  let uncovered = 0;
  let checked = 0;

  for (const source of REFERENCE_SOURCES) {
    const file = resolve(root, source.path);

    if (!existsSync(file)) {
      console.log(`SKIPPED  ${source.name} — not found at ${source.path}`);
      continue;
    }

    const references = extractCodes(readFileSync(file, 'utf8'), source.namespaces);
    const gaps = [...references].filter((code) => !isCovered(code, catalog));
    checked += references.size;

    if (gaps.length === 0) {
      console.log(`OK       ${source.name} — ${references.size} codes, all covered`);
      continue;
    }

    uncovered += gaps.length;
    console.log(`GAP      ${source.name} — ${gaps.length} uncovered:`);
    for (const gap of gaps) console.log(`           ${gap}`);
  }

  console.log(
    `\ncatalog: ${catalog.length} codes | references checked: ${checked} | uncovered: ${uncovered}`
  );

  if (uncovered > 0) {
    console.error('\nCatalog coverage FAILED — add the missing codes to permission-definitions.data.ts.');
    process.exit(1);
  }
}

main();
