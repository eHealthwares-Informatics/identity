# Backend CRUD Resource — rxsoft-identity

## Purpose

Scaffold a new CRUD resource following the clean-ish architecture pattern (domain entity + repository interface + TypeORM impl + use cases).

## When to invoke

When adding a new resource type (e.g., a new tenant-aware entity).

## When not to invoke

For entities that belong in another service.

## Inputs

- **Entity name**
- **Fields**
- **Whether it's org-scoped**

## Workflow

1. Create domain entity in `src/modules/{module}/domains/`.
2. Create TypeORM entity in `src/modules/{module}/entities/` (use string-based @ManyToMany('OtherEntity') to avoid circular deps).
3. Create repository interface in `src/modules/{module}/repositories/`.
4. Create TypeORM repository implementation.
5. Create DTOs with `class-validator`.
6. Create single-responsibility use cases in `services/`.
7. Create controller with list/get/create/patch/delete endpoints.
8. Register DI tokens and wire in module.

## Refactoring

When modifying existing controllers: if search/filter params are declared in Swagger but not actually used, wire them through to the repository layer.