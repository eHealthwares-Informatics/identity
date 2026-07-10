# Seeding — rxsoft-identity

## Purpose

Add or modify seed data for users, roles, permissions, organizations, and locations.

## When to invoke

When adding new seed roles, permissions, users, or configuration entities.

## Workflow

1. Add data to `src/database/seeds/seed-identity.ts` using the existing upsert pattern.
2. Gate behind `SEED_ON_START=true` env var (default: `true`).
3. Ensure seeds are idempotent — use upsert by unique key (e.g., role `code`, user `username + organizationId`).

## Refactoring

When adding new permissions, follow the dot-notation pattern: `module.resource.action` (e.g., `rxsoft.catalog.item.create`). Add to both the permission definitions data and the role that should inherit it.