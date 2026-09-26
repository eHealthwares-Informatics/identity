# Graph Report - /Users/john/develop/rxsoft/rxsoft-identity  (2026-07-09)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 554 nodes · 1123 edges · 26 communities (25 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.78)
- Token cost: 1,188 input · 1,911 output

## Community Hubs (Navigation)
- Auth Token Management
- Auth Controller & Guards
- Database Seed & User Entity
- User Request Decorators
- Create User DTO
- Project Dependencies
- Roles Controller
- Roles Update & Delete
- Locations Controller
- Organizations Controller
- TypeScript Configuration
- Role Repository
- Permission Mapping & Entity
- Refresh Token Repository
- Roles Guard & Decorators
- Role Repository & Mapper
- Permissions Controller
- Create Role DTO & Use Case
- Role ORM Entity
- Permissions Guard & Matcher
- JWT Token Issuer
- System Architecture Overview
- Use Cases & Modules
- Nest CLI Configuration
- Permissions & Roles Modules
- TypeScript Build Config

## God Nodes (most connected - your core abstractions)
1. `RoleRepository` - 31 edges
2. `UserRepository` - 27 edges
3. `Role` - 24 edges
4. `User` - 21 edges
5. `UserOrmEntity` - 21 edges
6. `RequestUser` - 19 edges
7. `CurrentUser` - 19 edges
8. `compilerOptions` - 19 edges
9. `RoleOrmEntity` - 17 edges
10. `PasswordHasherPort` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Yarn Configuration (.yarnrc.yml)` --references--> `RxSoft Identity Service`  [INFERRED]
  .yarnrc.yml → AGENTS.md
- `seedIdentity()` --indirect_call--> `PermissionOrmEntity`  [INFERRED]
  src/database/seeds/seed-identity.ts → src/modules/roles/entities/permission.orm-entity.ts
- `seedIdentity()` --indirect_call--> `RoleOrmEntity`  [INFERRED]
  src/database/seeds/seed-identity.ts → src/modules/roles/entities/role.orm-entity.ts
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  src/main.ts → src/app.module.ts
- `bootstrap()` --indirect_call--> `DatabaseSeedService`  [INFERRED]
  src/main.ts → src/database/seeding.service.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Identity Service Modules** — agents_identity_service, agents_auth_module, agents_users_module, agents_roles_module, agents_permissions_module, agents_organizations_module, agents_locations_module [EXTRACTED 1.00]

## Communities (26 total, 1 thin omitted)

### Community 0 - "Auth Token Management"
Cohesion: 0.08
Nodes (32): RefreshTokenRepository, PASSWORD_HASHER, REFRESH_TOKEN_REPOSITORY, ROLE_REPOSITORY, TOKEN_ISSUER, USER_REPOSITORY, LoginUseCase, Inject (+24 more)

### Community 1 - "Auth Controller & Guards"
Cohesion: 0.06
Nodes (40): HttpCode, Public, Public(), AuthController, MeResponse, ApiBearerAuth, ApiOperation, ApiProperty (+32 more)

### Community 2 - "Database Seed & User Entity"
Cohesion: 0.05
Nodes (42): OneToMany, AppModule, Module, DatabaseSeedService, Injectable, seedIdentity(), bootstrap(), AuthModule (+34 more)

### Community 3 - "User Request Decorators"
Cohesion: 0.08
Nodes (32): IsBoolean, Patch, CurrentUser, RequestUser, ApiBearerAuth, ApiOperation, ApiQuery, ApiTags (+24 more)

### Community 4 - "Create User DTO"
Cohesion: 0.09
Nodes (13): ArrayNotEmpty, User, CreateUserDto, ApiProperty, ApiPropertyOptional, IsArray, IsNotEmpty, IsOptional (+5 more)

### Community 5 - "Project Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, class-transformer, class-validator, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/jwt, @nestjs/platform-express (+19 more)

### Community 6 - "Roles Controller"
Cohesion: 0.12
Nodes (19): RolesController, toResponse(), ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, Body, Controller (+11 more)

### Community 7 - "Roles Update & Delete"
Cohesion: 0.17
Nodes (13): ApiPropertyOptional, IsArray, IsOptional, IsString, UpdateRoleDto, DeleteRoleUseCase, Injectable, GetRoleUseCase (+5 more)

### Community 8 - "Locations Controller"
Cohesion: 0.15
Nodes (15): LocationsController, ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, Body, Controller, Delete (+7 more)

### Community 9 - "Organizations Controller"
Cohesion: 0.15
Nodes (15): OrganizationsController, ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, Body, Controller, Delete (+7 more)

### Community 10 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (20): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+12 more)

### Community 11 - "Role Repository"
Cohesion: 0.11
Nodes (6): RoleRepository, Inject, Inject, Inject, Inject, Inject

### Community 12 - "Permission Mapping & Entity"
Cohesion: 0.19
Nodes (8): Permission, PermissionOrmEntity, Column, CreateDateColumn, Entity, ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn

### Community 13 - "Refresh Token Repository"
Cohesion: 0.14
Nodes (10): JoinColumn, ManyToOne, RefreshTokenOrmEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Injectable (+2 more)

### Community 14 - "Roles Guard & Decorators"
Cohesion: 0.22
Nodes (6): Roles(), JwtAuthGuard, Injectable, RolesGuard, Injectable, UserWithRoles

### Community 15 - "Role Repository & Mapper"
Cohesion: 0.27
Nodes (4): IdentityMapper, Role, Injectable, TypeormRoleRepository

### Community 16 - "Permissions Controller"
Cohesion: 0.18
Nodes (10): PermissionsController, ApiBearerAuth, ApiOperation, ApiTags, Controller, Get, UseGuards, PermissionModuleResponseDto (+2 more)

### Community 17 - "Create Role DTO & Use Case"
Cohesion: 0.18
Nodes (9): CreateRoleDto, ApiProperty, ApiPropertyOptional, IsArray, IsNotEmpty, IsOptional, IsString, CreateRoleUseCase (+1 more)

### Community 18 - "Role ORM Entity"
Cohesion: 0.18
Nodes (10): RoleOrmEntity, Column, CreateDateColumn, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, Unique (+2 more)

### Community 19 - "Permissions Guard & Matcher"
Cohesion: 0.24
Nodes (4): PermissionsGuard, Injectable, UserWithPermissions, permissionMatches()

### Community 20 - "JWT Token Issuer"
Cohesion: 0.36
Nodes (4): JwtTokenIssuerService, Injectable, TokenPair, TokenPayload

### Community 21 - "System Architecture Overview"
Cohesion: 0.29
Nodes (7): Auth Module, PostgreSQL Database, RxSoft Identity Service, JWT Token, LoginUseCase, TenantContext Helper, Yarn Configuration (.yarnrc.yml)

### Community 22 - "Use Cases & Modules"
Cohesion: 0.50
Nodes (4): CreateUserUseCase, Locations Module, Organizations Module, Users Module

### Community 23 - "Nest CLI Configuration"
Cohesion: 0.50
Nodes (3): collection, $schema, sourceRoot

### Community 24 - "Permissions & Roles Modules"
Cohesion: 0.67
Nodes (3): Permissions Module, RoleOrmEntity, Roles Module

## Knowledge Gaps
- **61 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `name`, `version` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `OrganizationsController` connect `Organizations Controller` to `Database Seed & User Entity`, `Roles Guard & Decorators`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `RequestUser` connect `User Request Decorators` to `Auth Token Management`, `Auth Controller & Guards`, `Roles Controller`, `Roles Update & Delete`, `Locations Controller`, `Roles Guard & Decorators`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `CurrentUser` connect `User Request Decorators` to `Auth Token Management`, `Auth Controller & Guards`, `Roles Controller`, `Roles Update & Delete`, `Locations Controller`, `Roles Guard & Decorators`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth Token Management` be split into smaller, more focused modules?**
  _Cohesion score 0.07550860719874804 - nodes in this community are weakly interconnected._
- **Should `Auth Controller & Guards` be split into smaller, more focused modules?**
  _Cohesion score 0.05649717514124294 - nodes in this community are weakly interconnected._
- **Should `Database Seed & User Entity` be split into smaller, more focused modules?**
  _Cohesion score 0.05297532656023222 - nodes in this community are weakly interconnected._