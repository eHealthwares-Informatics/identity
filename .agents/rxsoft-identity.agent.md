# RxSoft Identity Agent

## Overview

Standalone NestJS 11 identity service. Port 8092. npm. PostgreSQL.

## DB

PostgreSQL, same instance as rxsoft-backend, DB name: `identity`. `DB_SYNCHRONIZE=true` (dev). `DB_DROP_SCHEMA=true` in `.env` (dev only).

## Key commands

- `npm run start:dev` — dev server with watch
- `npm run build` — compile TypeScript

## Auth

Issues JWTs with shared `JWT_ACCESS_SECRET` (default: `admin-access-secret`). Access tokens: 15 min. Refresh tokens: 7 days (hashed, stored in DB).

**Auth guards**: `JwtAuthGuard` (validates Bearer token or `x-api-key`), `RolesGuard` (checks `@Roles()`), `PermissionsGuard` (checks `@Permissions()` with wildcard matching).

**Password hashing**: Currently SHA-256 (no salt) — should be migrated to bcrypt/argon2 for production.

## Token payload

```typescript
{ sub: string, organizationId: string|null, locationId: string|null,
  username: string, roles: string[], permissions: string[] }
```

## Architecture

Clean-ish architecture: domain entities, repository interfaces, TypeORM impls, use cases, DI tokens. String-based TypeORM relations (`@ManyToMany('RoleOrmEntity')`) to avoid circular deps.

## Modules

- **auth**: Login, register, refresh token, me
- **users**: CRUD user accounts with org/location assignment
- **roles**: Role definitions with permission codes
- **organizations**: Tenant organizations (stub — returns empty data)
- **locations**: Locations scoped to org (stub — returns empty data)

## Refactoring deviations (fix when touching)

### List endpoints (WORST — largely unimplemented)
- **No ListQueryDto exists** — each controller captures raw `@Query()` params
- **Users**: `search` param declared in Swagger via `@ApiQuery()` but **NOT passed to use case** — search is a no-op
- **Roles**: `page`, `limit`, `search` declared but **ignored** — `listRolesUseCase.execute()` returns all roles without pagination
- **Organizations**: returns `{ data: [] }` — **stub with no implementation**
- **Locations**: same — returns `{ data: [] }` — **stub**
- **Roles returns raw array** instead of `{ data, meta }` envelope

### Auth
- **Password hashing**: `Sha256PasswordHasher` — plain SHA-256 (no salt) — **must migrate to bcrypt/argon2**
- PermissionsGuard exists but **unused** — controllers only use `@Roles()` + RolesGuard
- Internal API key: `x-api-key` header creates a synthetic `system` super_admin user

### Tests
- **ZERO TESTS** — no test framework, no test files, no test scripts
- **Priority**: add integration tests using SQLite (`DB_TYPE=sqlite`) + supertest
- Copy pattern from `rxsoft-backend/src/integration/support/sqlite-test-helpers.ts`
- Unit tests for use cases (LoginUseCase, CreateUserUseCase, etc.)

### Seeding
- Seeds on startup by default (`SEED_ON_START=true`) — change default to `false` for production safety
- Creates: 1 org, 5 locations, 75 permissions (12 modules), 12 roles, 12 users (password: "password" hashed via SHA-256)
- Idempotent: `findOne({ code })` → if not exists, create (no updates)
- **Password hash in seed uses SHA-256** — if passwords are migrated to bcrypt/argon2, update seed too

### Schema
- `DB_SYNCHRONIZE=true` — OK for dev
- `DB_DROP_SCHEMA=true` in `.env` — **high risk, data loss on every restart**
- **Remove `DB_DROP_SCHEMA=true`** or gate behind `NODE_ENV=development`
- No migration files needed for dev, but needed for production

### Clean-ish architecture
- Repository interfaces + TypeORM implementations + use cases + DI tokens
- String-based TypeORM relations (`@ManyToMany('RoleOrmEntity')`) to avoid circular deps
- This is the **template pattern** that other projects should follow