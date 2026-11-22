# rxsoft-identity

Standalone identity service for the RxSoft monorepo. Manages users, authentication, roles, permissions, organizations, and locations. Issues JWT tokens consumed by all other backend services.

## Setup

```bash
npm install
```

## Commands

- `npm run start:dev` — dev server with watch on port 8092
- `npm run build` — compile TypeScript
- `npm run start` — production start
- `npm test` — unit tests
- `npm run check:catalog` — verify references (frontend sidebar, seed/identity templates) against the permission catalog (needs `npm run build` first)
- `npm run check:drift` — tenant template + permission-catalog + module-list drift guard (no build needed)

## Database

- PostgreSQL, same instance as `rxsoft-backend`
- DB name: `identity` (set via `DB_NAME` in `.env`)
- `DB_SYNCHRONIZE=true` by default for dev (auto-creates tables)

## JWT

- Tokens signed with `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` from `.env`
- Consumer services validate tokens locally using the same secret

## Token payload

```typescript
{
  sub: string;              // user UUID
  organizationId: string | null;  // null = global admin
  locationId: string | null;      // user's assigned location
  username: string;
  roles: string[];
  permissions: string[];
}
```

## Tenant scoping

Other backends consume the JWT and apply tenant filters using the `TenantContext` helper:

```typescript
const tenant = tenantFromUser(currentUser);
// Normal user: WHERE org_id = X OR org_id IS NULL
// Global admin (org_id === null): no filter
```

## Modules

| Module | Endpoints | Description |
|---|---|---|
| `auth` | `POST /auth/login`, `POST /auth/refresh-token`, `GET /auth/me` | Login & token management |
| `users` | CRUD `/users` | User accounts with org/location assignment |
| `roles` | CRUD `/roles` | Role definitions with permission codes |
| `permissions` | `GET /permissions/modules` | Available permissions grouped by module |
| `organizations` | CRUD `/organizations` | Tenant organizations |
| `locations` | CRUD `/locations` | General-purpose locations scoped to org |
| `provision` | `POST /provision` (202), `GET /provision/health`, `GET /provision/status/:code`, `POST /provision/:code/resume`, `DELETE /provision/:code` | Native tenant provisioning/teardown (identity + rxsoft + EMR). Async durable job (`provisioning_jobs`) + in-process worker. Public, gated by `ONBOARD_ORGANISATIONS_ENABLED` |
| `auth` onboarding | `POST /auth/onboard-organization` (`@Public()`, 202) | Queues self-serve organisation signup; client polls `/provision/status/:code` |

### Provisioning

Production onboarding is fully native — identity must not depend on the `seed/` service.

- `src/modules/provision/org-template.json` is the tenant template (roles, users, EMR departments/wards/beds, demo patients/admissions, location/price-list constants). `org-template.ts` is a thin typed wrapper.
- `seed/src/provision/org-template.json` is a byte-identical copy for seed's local CLI/e2e provisioner. `node ../scripts/check-provision-drift.mjs` (or `npm run check:drift`) fails when the copies, the permission catalog, seed `permissions.json`/`role_permissions.json`, or the frontend module list diverge.
- `GET /provision/status/:code` returns `counts` for every table the provisioner writes (identity/backend/emr). The onboarding e2e uses it to prove a full tenant was created and that deprovision empties the EMR clinical block too.
- Demo accounts (`demo_<module>` in the DEFAULT org, mapped to the existing `<module>_admin` roles) are seeded by `seed/seeds/identity/inline/{users,user_roles}.json` via `npm run seed -- --target identity` (run from `seed/`).

## Architecture

- **Clean-ish**: Port/adapter pattern with repository interfaces + TypeORM implementations
- **Use cases**: Single-responsibility classes (e.g., `CreateUserUseCase`, `LoginUseCase`)
- **String-based relations**: TypeORM entities use strings (e.g., `@ManyToMany('RoleOrmEntity')`) to avoid circular dependency issues
