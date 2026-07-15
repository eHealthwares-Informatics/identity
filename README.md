# RxSoft Identity

Standalone identity service for the RxSoft platform. Manages users, authentication, roles, permissions, organizations, and locations. Issues JWT tokens consumed by all other backend services.

Part of the [RxSoft monorepo](https://github.com/anomalyco/rxsoft).

## Stack

| Aspect | Technology |
|---|---|
| Runtime | Node.js |
| Framework | NestJS 11 |
| Database | PostgreSQL (same instance as rxsoft-backend) |
| ORM | TypeORM 0.3 |
| Auth | JWT (access + refresh tokens) |
| API Docs | Swagger at `/docs` |
| PM | npm |

## Quick Start

```bash
npm install
npm run start:dev
```

The API defaults to **port 8092** (configurable via `PORT`).

## Modules

| Module | Endpoints | Description |
|---|---|---|
| **auth** | `POST /auth/login`, `POST /auth/refresh-token`, `GET /auth/me` | Login & token management |
| **users** | CRUD `/users` | User accounts with org/location assignment |
| **roles** | CRUD `/roles` | Role definitions with permission codes |
| **permissions** | `GET /permissions/modules` | Available permissions grouped by module |
| **organizations** | CRUD `/organizations` | Tenant organizations |
| **locations** | CRUD `/locations` | General-purpose locations scoped to org |

## Architecture

- **Clean-ish architecture**: Port/adapter pattern with repository interfaces + TypeORM implementations
- **Use cases**: Single-responsibility classes (e.g., `CreateUserUseCase`, `LoginUseCase`)
- **String-based relations**: TypeORM entities use strings (`@ManyToMany('RoleOrmEntity')`) to avoid circular dependency issues
- Base path: `~/...` shared utilities

## JWT Token Payload

```typescript
{
  sub: string;                   // user UUID
  organizationId: string | null; // null = global admin
  locationId: string | null;     // user's assigned location
  username: string;
  roles: string[];
  permissions: string[];
}
```

## Tenant Scoping

Other backends consume the JWT and apply tenant filters using the `TenantContext` helper:

```typescript
const tenant = tenantFromUser(currentUser);
// Normal user: WHERE org_id = X OR org_id IS NULL
// Global admin (org_id === null): no filter
```

## Commands

| Command | Description |
|---|---|
| `npm run start:dev` | Dev server with watch (`nest start --watch`) |
| `npm run build` | Compile TypeScript |
| `npm run start` | Production start |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | 8092 | Server port |
| `DB_TYPE` | `postgres` | Database type |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `identity` | Database name |
| `DB_SYNCHRONIZE` | `true` | Auto-create tables (dev) |
| `DB_DROP_SCHEMA` | `true` | Drop schema on start |
| `TYPEORM_LOGGING` | `false` | Query logging |
| `SEED_ON_START` | `true` | Seed on startup |
| `JWT_ACCESS_SECRET` | `admin-access-secret` | Access token signing secret |
| `JWT_REFRESH_SECRET` | `admin-refresh-secret` | Refresh token signing secret |
| `INTERNAL_API_KEY` | `rxsoft-internal-key` | Service-to-service auth |

## Database

PostgreSQL, same instance as `rxsoft-backend`. Database name: `identity` (set via `DB_NAME`). `synchronize: true` by default for dev (auto-creates tables). Use migrations for production.

## See Also

- [`AGENTS.md`](https://github.com/anomalyco/rxsoft/blob/main/rxsoft-identity/AGENTS.md) — Detailed identity service documentation
- [`../BACKEND_SEARCH_ARCHITECTURE.md`](https://github.com/anomalyco/rxsoft/blob/main/BACKEND_SEARCH_ARCHITECTURE.md) — List/search endpoint standards
- [`../AGENTS.md`](https://github.com/anomalyco/rxsoft/blob/main/AGENTS.md) — Monorepo overview
