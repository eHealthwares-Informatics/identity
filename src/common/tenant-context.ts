import {
  OrganizationScope,
  RequestUser,
} from './decorators/current-user.decorator';

/**
 * Resolved tenant for the current request.
 *
 * - `all`    — super admin with no organisation selected: no organisation filter.
 * - `global` — super admin selected "Global": only null-org records.
 * - `org`    — a concrete organisation (normal users always land here).
 */
export interface TenantContext {
  organizationId: string | null;
  locationId: string | null;
  /** @deprecated Prefer `isSuperAdmin` + `organizationScope`. */
  isGlobalAdmin: boolean;
  isSuperAdmin: boolean;
  organizationScope: OrganizationScope;
  userId: string | null;
}

const ALL_ORG_MARKERS = new Set(['', 'all', '*']);
const GLOBAL_ORG_MARKERS = new Set(['null', 'global', 'none']);

/**
 * Identity issues `organizationId: ""` for users without an organisation
 * (e.g. `super_admin`). Blank/whitespace means "no tenant" and becomes null so
 * it can never reach a Postgres `uuid` column as the empty string.
 */
export function normalizeTenantId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Normalise JWT tenant claims and apply the super-admin-only
 * `x-organization-id` / `x-location-id` header overrides.
 */
export function resolveTenantClaims<T extends Record<string, any>>(
  payload: T,
  headers: Record<string, string | string[] | undefined> = {},
): T & { organizationId: string | null; locationId: string | null; organizationScope: OrganizationScope } {
  const roles = Array.isArray(payload?.roles) ? (payload.roles as string[]) : [];
  const isSuperAdmin = roles.includes('super_admin');

  let organizationId = normalizeTenantId(payload?.organizationId);
  let locationId = normalizeTenantId(payload?.locationId);
  let organizationScope: OrganizationScope = isSuperAdmin
    ? organizationId
      ? 'org'
      : 'all'
    : 'org';

  if (isSuperAdmin) {
    const rawOrg = headerValue(headers['x-organization-id']);
    if (rawOrg !== undefined) {
      const marker = rawOrg.trim().toLowerCase();
      if (ALL_ORG_MARKERS.has(marker)) {
        organizationId = null;
        organizationScope = 'all';
      } else if (GLOBAL_ORG_MARKERS.has(marker)) {
        organizationId = null;
        organizationScope = 'global';
      } else {
        organizationId = rawOrg.trim();
        organizationScope = 'org';
      }
    }

    const rawLocation = headerValue(headers['x-location-id']);
    if (rawLocation !== undefined) {
      const marker = rawLocation.trim().toLowerCase();
      if (ALL_ORG_MARKERS.has(marker) || GLOBAL_ORG_MARKERS.has(marker)) {
        locationId = null;
      } else {
        locationId = rawLocation.trim();
      }
    }
  }

  return { ...payload, organizationId, locationId, organizationScope };
}

export function tenantFromUser(
  user: Partial<RequestUser> | null | undefined,
): TenantContext {
  const roles = Array.isArray(user?.roles) ? user!.roles : [];
  const isSuperAdmin = roles.includes('super_admin');
  const organizationId = normalizeTenantId(user?.organizationId);
  const locationId = normalizeTenantId(user?.locationId);

  const organizationScope: OrganizationScope = isSuperAdmin
    ? user?.organizationScope ?? (organizationId ? 'org' : 'all')
    : 'org';

  return {
    organizationId,
    locationId,
    isGlobalAdmin: isSuperAdmin && !organizationId,
    isSuperAdmin,
    organizationScope,
    userId: user?.sub ?? null,
  };
}
