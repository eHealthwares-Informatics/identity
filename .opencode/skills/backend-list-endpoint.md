# Backend List Endpoint — rxsoft-identity

## Purpose

Create or fix list/search endpoints in rxsoft-identity following `BACKEND_SEARCH_ARCHITECTURE.md`.

## When to invoke

When adding or modifying a list endpoint in auth, users, roles, organizations, or locations modules.

## When not to invoke

For single-entity retrieval.

## Inputs

- **Module** (users, roles, organizations, locations)
- **Searchable columns**

## Workflow

1. Use `ListQueryDto` with `page`, `limit`, `search`, `sortBy`, `sortOrder` — add to `src/modules/{module}/dto/` if missing.

2. In the repository's `list()` or `listAll()` method:
   - Add `search` ILIKE filtering on relevant columns
   - Add `sortBy`/`sortOrder` parameters with allow-list validation
   - Use `skip/take` for offset pagination
   - Respect `organizationId` scoping and `deletedAt IS NULL`

3. Return `{ data, meta: { page, limit, total } }` envelope.

## Refactoring consistency

Known gaps in this package:
- **Users list**: `search` parameter is accepted but NOT used in the controller — wire it through to the repository
- **Roles list**: pagination declared but all roles returned at once — add skip/take
- **Organizations / Locations**: controllers return hardcoded `{ data: [] }` — implement actual query
- **No sort column allow-lists** — always add one: `['name', 'code', 'createdAt', 'updatedAt']`