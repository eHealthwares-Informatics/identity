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

## Architecture

- **Clean-ish**: Port/adapter pattern with repository interfaces + TypeORM implementations
- **Use cases**: Single-responsibility classes (e.g., `CreateUserUseCase`, `LoginUseCase`)
- **String-based relations**: TypeORM entities use strings (e.g., `@ManyToMany('RoleOrmEntity')`) to avoid circular dependency issues
