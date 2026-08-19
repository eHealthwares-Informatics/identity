# Seeding — rxsoft-identity

## Purpose

Add or modify seed data for users, roles, permissions, organizations, and locations.

## When to invoke

When adding new seed roles, permissions, users, or configuration entities.

## Workflow

1. Seed data for identity lives in the standalone **`seed/`** service (single owner
   per `IMPORT_ARCHITECTURE.md`). Identity itself no longer runs a local seed engine.
2. Add/update data under `seed/seeds/identity/inline/` (e.g. `permissions.json`,
   `roles.json`, `role_permissions.json`, `users.json`, `user_roles.json`,
   `organizations.json`, `locations.json`).
3. Register/adjust the per-entity `ImportEntityConfig` in `seed/src/config/import-config.ts`
   (target `identity`).
4. Run with `npm run seed` in `seed/`, or `POST /api/imports` on the seed service.
5. Roles/permissions/users must stay idempotent — upsert by unique key (role `code`,
   user `username`, junction rows by the FK pair).

## Refactoring

When adding new permissions, follow the dot-notation pattern: `module.resource.action`
(e.g., `rxsoft.catalog.item.create`). Add to both the permission definitions data
(`seed/seeds/identity/inline/permissions.json`) and the role that should inherit it
(`role_permissions.json`).
