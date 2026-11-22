#!/usr/bin/env node
/**
 * Provisioning / permission drift guard.
 *
 * Identity and seed each ship a standalone copy of the tenant template. This
 * script (also shipped inside each package so `npm run check:drift` works in a
 * standalone checkout) compares the copies — plus the permission catalog, seed
 * role grants and the frontend module list — and fails on divergence.
 *
 * Missing sibling repos are SKIPPED, not an error: a standalone identity clone
 * has no seed/frontend checkout, and a standalone seed clone has no identity or
 * frontend. In the monorepo all four files exist and every check runs.
 *
 * Usage:
 *   node scripts/check-provision-drift.mjs
 *   node scripts/check-provision-drift.mjs --fix
 *   node scripts/check-provision-drift.mjs --fix-template
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The script lives at <monorepo>/identity/scripts or <monorepo>/seed/scripts,
// so `../..` is the monorepo root. In a standalone clone it is the parent
// directory; the sibling paths below then simply do not exist and are skipped.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIX = process.argv.includes('--fix');
const FIX_TEMPLATE = process.argv.includes('--fix-template');

const paths = {
  identityTemplate: resolve(ROOT, 'identity/src/modules/provision/org-template.json'),
  seedTemplate: resolve(ROOT, 'seed/src/provision/org-template.json'),
  catalog: resolve(ROOT, 'identity/src/modules/roles/services/permission-definitions.data.ts'),
  seedPermissions: resolve(ROOT, 'seed/seeds/identity/inline/permissions.json'),
  seedRolePermissions: resolve(ROOT, 'seed/seeds/identity/inline/role_permissions.json'),
  modules: resolve(ROOT, 'frontend/src/features/shared/module-data.ts'),
  availableModules: resolve(ROOT, 'identity/src/modules/roles/services/permission.data.ts'),
};

const errors = [];
const notes = [];
const skipped = [];
const fail = (message) => errors.push(message);

const readText = (file) => readFileSync(file, 'utf8');
const maybeText = (file) => {
  if (!existsSync(file)) {
    skipped.push(file);
    return null;
  }
  return readText(file);
};
const maybeJson = (file) => {
  const text = maybeText(file);
  return text === null ? null : JSON.parse(text);
};

function parseCatalog(source) {
  const blocks = source.matchAll(
    /\{\s*code: '([^']+)',\s*name: '([^']*)',\s*description: '([^']*)',\s*resource: '([^']*)',\s*action: '([^']*)'\s*\}/g,
  );
  return [...blocks].map((m) => ({
    code: m[1],
    name: m[2],
    description: m[3],
    resource: m[4],
    action: m[5],
  }));
}

function moduleIds(source) {
  return [...source.matchAll(/\bid: '([a-z][a-z-]*)'/g)].map((m) => m[1]);
}

function main() {
  // ── 1. Identity and seed tenant templates must be identical ─────────────
  const identityTemplateText = maybeText(paths.identityTemplate);
  const seedTemplateText = maybeText(paths.seedTemplate);
  if (identityTemplateText !== null && seedTemplateText !== null) {
    if (identityTemplateText !== seedTemplateText) {
      if (FIX_TEMPLATE) {
        writeFileSync(paths.seedTemplate, identityTemplateText);
        notes.push('copied identity template → seed template (--fix-template)');
      } else {
        fail(
          'tenant templates differ:\n' +
            '  identity/src/modules/provision/org-template.json\n' +
            '  seed/src/provision/org-template.json\n' +
            '  Fix: node scripts/check-provision-drift.mjs --fix-template',
        );
      }
    }
  } else if (identityTemplateText === null || seedTemplateText === null) {
    notes.push('tenant template comparison skipped (only one sibling checkout present)');
  }

  const identityTemplate = identityTemplateText ? JSON.parse(identityTemplateText) : null;
  const seedTemplate = seedTemplateText ? JSON.parse(seedTemplateText) : null;

  // ── 2. Permission catalog (identity) is the canonical code list ─────────
  const catalogSource = maybeText(paths.catalog);
  const catalog = catalogSource ? parseCatalog(catalogSource) : null;
  const catalogCodes = new Set((catalog ?? []).map((p) => p.code));
  // `*` is the super-admin wildcard. It intentionally has no catalog module but
  // must remain a valid permission row because the seeded super_admin role
  // grants it.
  const canonicalCodes = catalog ? new Set([...catalogCodes, '*']) : null;

  // ── 3. Every template grant must resolve against the canonical catalog ───
  if (canonicalCodes) {
    for (const [side, template] of [
      ['identity', identityTemplate],
      ['seed', seedTemplate],
    ]) {
      if (!template) continue;
      for (const [roleCode, role] of Object.entries(template.roles ?? {})) {
        for (const code of role.permissions ?? []) {
          if (!canonicalCodes.has(code)) {
            fail(`${side} template role "${roleCode}" grants unknown permission "${code}"`);
          }
        }
      }
    }
  }

  // ── 4. Seed permissions.json must equal catalog ∪ {"*"} ─────────────────
  const seedPermissions = maybeJson(paths.seedPermissions);
  const seedPermissionCodes = new Set((seedPermissions ?? []).map((p) => p.code));
  if (canonicalCodes && seedPermissions) {
    for (const code of canonicalCodes) {
      if (!seedPermissionCodes.has(code)) {
        fail(`seed permissions.json is missing catalog code "${code}"`);
      }
    }
    for (const code of seedPermissionCodes) {
      if (!canonicalCodes.has(code)) {
        fail(`seed permissions.json has code "${code}" that is not in the identity catalog`);
      }
    }
  }

  // ── 5. Seed role grants must use concrete (parent/leaf) catalog codes ────
  const seedRolePermissions = maybeJson(paths.seedRolePermissions);
  const normalized = [];
  if (canonicalCodes && seedRolePermissions) {
    const seen = new Set();
    for (const row of seedRolePermissions) {
      const code = String(row.permission_code ?? '').replace(/\.\*$/, '');
      if (!canonicalCodes.has(code)) {
        fail(
          `seed role_permissions grants "${row.permission_code}" to "${row.role_code}" — ` +
            'not in the identity catalog',
        );
        continue;
      }
      const key = `${row.role_code}|${code}`;
      if (seen.has(key)) {
        notes.push(`dropped duplicate grant ${row.role_code} → ${code}`);
        continue;
      }
      seen.add(key);
      if (code !== row.permission_code) {
        notes.push(`normalized ${row.role_code}: ${row.permission_code} → ${code}`);
      }
      normalized.push({ role_code: row.role_code, permission_code: code });
    }
  }

  // ── 6. Frontend module list must match identity's AVAILABLE_MODULES ──────
  const modulesSource = maybeText(paths.modules);
  const availableModulesSource = maybeText(paths.availableModules);
  if (modulesSource && availableModulesSource) {
    const frontendModules = moduleIds(modulesSource);
    const identityModules = moduleIds(availableModulesSource);
    const missingInIdentity = frontendModules.filter((id) => !identityModules.includes(id));
    const missingInFrontend = identityModules.filter((id) => !frontendModules.includes(id));
    if (missingInIdentity.length || missingInFrontend.length) {
      fail(
        'module lists differ between frontend module-data.ts and identity AVAILABLE_MODULES:\n' +
          (missingInIdentity.length ? `  frontend only: ${missingInIdentity.join(', ')}\n` : '') +
          (missingInFrontend.length ? `  identity only: ${missingInFrontend.join(', ')}\n` : ''),
      );
    }
  }

  // ── --fix: rewrite seed permissions + normalize grants ──────────────────
  let finalPermissionCount = seedPermissionCodes.size;
  if (FIX) {
    if (!catalog || !seedPermissions || !seedRolePermissions) {
      notes.push('--fix skipped: seed permissions files are not present in this checkout');
    } else {
      const canonicalPermissions = [...catalog]
        .map(({ code, resource, action, description }) => ({
          code,
          resource,
          action,
          description,
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
      canonicalPermissions.push({
        code: '*',
        resource: '*',
        action: '*',
        description: 'Full system access',
      });
      writeFileSync(paths.seedPermissions, `${JSON.stringify(canonicalPermissions, null, 2)}\n`);
      writeFileSync(paths.seedRolePermissions, `${JSON.stringify(normalized, null, 2)}\n`);
      notes.push(
        `rewrote seed permissions.json (${canonicalPermissions.length} codes) and ` +
          `role_permissions.json (${normalized.length} grants)`,
      );
      finalPermissionCount = canonicalPermissions.length;
      errors.length = 0;
    }
  }

  for (const note of notes) console.log(`note     ${note}`);
  for (const file of skipped) console.log(`skipped  ${file.replace(`${ROOT}/`, '')} (missing)`);

  if (errors.length) {
    console.error(`\n${errors.length} drift problem(s):`);
    for (const error of errors) console.error(`  ✗ ${error}`);
    console.error('\nRun with --fix (permissions) / --fix-template (tenant template) to correct.');
    process.exit(1);
  }
  console.log(
    `OK       templates checked | catalog ${catalog ? catalogCodes.size : 'n/a'} codes | ` +
      `seed permissions ${finalPermissionCount || 'n/a'} | skipped ${skipped.length}`,
  );
}

main();
