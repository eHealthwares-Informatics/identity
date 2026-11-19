import { permissionMatches } from '../../../common/utils/permission-matcher';
import { ModuleInfoDto } from '../dto/module-info.dto';

// `root` values are frontend route paths (the module chooser / single-module
// redirect navigates to them directly). They used to be backend roots
// (`/items`, `/conversations`, …), which matched no frontend route and caused
// the post-onboarding redirect to bounce through `/` to `/modules`.
export const AVAILABLE_MODULES: ModuleInfoDto[] = [
  { id: 'rxsoft', name: 'RxSoft', description: 'Pharmacy Admin', root: '/rxsoft/dashboard', permissionRoots: ['rxsoft'] },
  { id: 'conversation', name: 'Conversation', description: 'Workflow Chat', root: '/conversation/dashboard' },
  { id: 'communication', name: 'Switch', description: 'Messaging & Routing', root: '/communication/dashboard' },
  { id: 'coding-concept', name: 'Coding Concept', description: 'Terminology', root: '/coding-concept/dashboard' },
  { id: 'lis', name: 'LIS', description: 'Laboratory', root: '/lis/dashboard' },
  { id: 'emr', name: 'EMR', description: 'Electronic Medical Record', root: '/emr/dashboard' },
  {
    id: 'admin',
    name: 'Admin Console',
    description: 'Administration',
    root: '/admin/dashboard',
    permissionRoots: ['admin', 'rxsoft.admin'],
  },
  {
    id: 'website',
    name: 'Website Console',
    description: 'Website',
    root: '/website/dashboard',
    permissionRoots: ['website', 'rxsoft.website', 'shop', 'rxsoft.shop'],
  },
  {
    // Organisations, locations, users, roles: granted by the identity
    // namespace, whether held directly or through the compressed rxsoft root.
    id: 'identity',
    name: 'Identity',
    description: 'Identity & Access',
    root: '/identity/dashboard',
    permissionRoots: ['identity', 'rxsoft.identity'],
  },
];

/**
 * A permission grants a module root when the shared matcher says so.
 *
 * Deliberately NOT a hand-rolled prefix check: login compresses role grants, so
 * an admin who holds `rxsoft.admin.*` is issued the broader `rxsoft.*`. An
 * exported prefix test treats that as "not under rxsoft.admin" and drops the
 * Admin module from `/auth/me`. `permissionMatches` understands the `*` segment,
 * so `rxsoft.*` covers `rxsoft.admin` exactly as the backend guards do. Roots
 * may also be granted from either side (`rxsoft.website.content.read` grants
 * `rxsoft.website`), hence the reverse check.
 */
function grantsRoot(permission: string, root: string): boolean {
  return permissionMatches(permission, root) || permissionMatches(root, permission);
}

export function getUserModules(permissions: string[], roleCodes: string[] = []): ModuleInfoDto[] {
  if (roleCodes.includes('super_admin')) {
    return AVAILABLE_MODULES;
  }

  return AVAILABLE_MODULES.filter((mod) => {
    const roots = mod.permissionRoots ?? [mod.id];
    return roots.some((root) => permissions.some((perm) => grantsRoot(perm, root)));
  });
}
