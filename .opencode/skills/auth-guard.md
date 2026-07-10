# Auth Guard — rxsoft-identity

## Purpose

Add or modify auth guards in the identity service itself.

## When to invoke

When adding new endpoints or modifying auth behavior in the identity service.

## Workflow

1. Use `JwtAuthGuard` for protected endpoints — validates Bearer token against `JWT_ACCESS_SECRET`.
2. Supports `x-api-key` header (matching `INTERNAL_API_KEY`) for service-to-service calls, creating a synthetic `system` user with `super_admin` role.
3. `RolesGuard` checks `@Roles()` decorator against user's roles.
4. `PermissionsGuard` checks `@Permissions()` decorator — available but currently unused on controllers.
5. `@Public()` decorator for opt-out (login, register, refresh-token).

## Refactoring

- **PermissionsGuard exists but is unused** — if adding new permission checks, prefer `@Permissions()` over `@Roles()` for finer-grained access
- **Search/filter params declared but not wired** — when fixing controllers, ensure declared query params are actually functional