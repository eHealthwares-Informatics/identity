# Graph Report - identity  (2026-10-13)

## Corpus Check
- 138 files · ~28,847 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .gz 1)

## Summary
- 1134 nodes · 2778 edges · 85 communities (33 shown, 52 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 103 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7ad9b87e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CreateUserDto
- RegisterDto
- jwt-auth.guard.ts
- Roles
- User
- dependencies
- CurrentUser
- DeleteRoleUseCase
- RequestUser
- OrganizationsController
- locations.controller.ts
- Role
- PermissionOrmEntity
- OrganizationRepository
- JwtAuthGuard
- deprovision-cleanup.ts
- PermissionsController
- CreateRoleDto
- organizations.controller.ts
- permissions.guard.ts
- auth.module.ts
- rxsoft-identity
- CreateUserUseCase
- role-requests.module.ts
- Permissions Module
- compilerOptions
- AuthController
- package.json
- RxSoft Identity Agent
- LocationOrmEntity
- Location
- ProvisionController
- ProvisionOrganisationDto
- ShopperRequestOtpDto
- UserOrmEntity
- @nestjs/swagger
- Organization
- ProvisionService
- provision.service.ts
- WebsiteAccountService
- UpdateOrganizationDto
- OnboardOrganisationDto
- ConversationClient
- OrganizationOrmEntity
- UpdateUserDto
- auth.controller.ts
- CreateLocationDto
- LocationRepository
- Backend CRUD Resource — rxsoft-identity
- Backend List Endpoint — rxsoft-identity
- CreateOrganizationDto
- RawUpsertTarget
- users.controller.ts
- Auth Guard — rxsoft-identity
- Seeding — rxsoft-identity
- RefreshTokenDto
- LogoutAllDto
- devDependencies
- UpdateRoleDto
- roles.controller.ts
- AuthActionTokenOrmEntity
- RoleOrmEntity
- TypeormRefreshTokenRepository
- RxSoft Identity Service
- create-location.use-case.ts
- ListRolesUseCase
- Refactoring deviations (fix when touching)
- Auth Module
- Locations Module
- LoginUseCase
- Organizations Module
- RoleOrmEntity
- Roles Module
- TenantContext Helper
- Users Module
- RefreshTokenOrmEntity
- scripts
- permissions.controller.ts
- nest-cli.json
- tsconfig.build.json
- Permission
- OrganizationsModule

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 69 edges
2. `RoleRepository` - 39 edges
3. `UserRepository` - 38 edges
4. `User` - 37 edges
5. `RequestUser` - 34 edges
6. `CurrentUser` - 33 edges
7. `@nestjs/swagger` - 32 edges
8. `Roles()` - 32 edges
9. `PasswordHasherPort` - 29 edges
10. `Role` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Architecture` --references--> `LoginUseCase`  [INFERRED]
  README.md → src/modules/auth/services/login.use-case.ts
- `Auth` --references--> `JwtAuthGuard`  [INFERRED]
  .agents/rxsoft-identity.agent.md → src/common/guards/jwt-auth.guard.ts
- `Workflow` --references--> `JwtAuthGuard`  [INFERRED]
  .opencode/skills/auth-guard.md → src/common/guards/jwt-auth.guard.ts
- `Auth` --references--> `PermissionsGuard`  [INFERRED]
  .agents/rxsoft-identity.agent.md → src/common/guards/permissions.guard.ts
- `Workflow` --references--> `PermissionsGuard`  [INFERRED]
  .opencode/skills/auth-guard.md → src/common/guards/permissions.guard.ts

## Import Cycles
- None detected.

## Communities (85 total, 52 thin omitted)

### Community 0 - "CreateUserDto"
Cohesion: 0.05
Nodes (15): Architecture, Commands, Database, Environment Variables, JWT Token Payload, Modules, Quick Start, RxSoft Identity (+7 more)

### Community 2 - "jwt-auth.guard.ts"
Cohesion: 0.29
Nodes (3): @nestjs/core, AppModule, IS_PUBLIC_KEY

### Community 3 - "Roles"
Cohesion: 0.16
Nodes (3): Roles(), UsersController, UserResponseDto

### Community 4 - "User"
Cohesion: 0.09
Nodes (5): ShopperAuthService, TokenPair, WebsiteAuthService, User, TypeormUserRepository

### Community 5 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, class-transformer, class-validator, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/jwt, @nestjs/platform-express (+7 more)

### Community 6 - "CurrentUser"
Cohesion: 0.15
Nodes (3): CurrentUser, RolesController, toResponse()

### Community 8 - "RequestUser"
Cohesion: 0.14
Nodes (3): RequestUser, LocationsController, UpdateLocationDto

### Community 10 - "locations.controller.ts"
Cohesion: 0.16
Nodes (8): LOCATION_REPOSITORY, LocationResponse, LocationsListResponse, LocationsModule, DeleteLocationUseCase, GetLocationUseCase, ListLocationsUseCase, UpdateLocationUseCase

### Community 14 - "JwtAuthGuard"
Cohesion: 0.18
Nodes (5): Auth, Workflow, JwtAuthGuard, PermissionsGuard, RolesGuard

### Community 15 - "deprovision-cleanup.ts"
Cohesion: 0.13
Nodes (13): affectedRows(), chunkDeleteSql(), CleanupOptions, cleanupOptionsFromEnv(), CleanupOutcome, CleanupStep, countRemainingSql(), DEFAULT_CLEANUP_OPTIONS (+5 more)

### Community 18 - "organizations.controller.ts"
Cohesion: 0.21
Nodes (8): ORG_REPOSITORY, OrganizationsListResponse, OrganizationListOptions, CreateOrganizationUseCase, DeleteOrganizationUseCase, GetOrganizationUseCase, ListOrganizationsUseCase, UpdateOrganizationUseCase

### Community 19 - "permissions.guard.ts"
Cohesion: 0.32
Nodes (3): PERMISSIONS_KEY, UserWithPermissions, permissionMatches()

### Community 20 - "auth.module.ts"
Cohesion: 0.05
Nodes (34): @nestjs/common, @nestjs/config, @nestjs/jwt, @nestjs/typeorm, typeorm, AuthModule, PhoneOtpOrmEntity, UserLoginEventOrmEntity (+26 more)

### Community 21 - "rxsoft-identity"
Cohesion: 0.20
Nodes (9): Architecture, Commands, Database, JWT, Modules, rxsoft-identity, Setup, Tenant scoping (+1 more)

### Community 23 - "role-requests.module.ts"
Cohesion: 0.07
Nodes (9): RoleRequestsController, CreateRoleRequestDto, UpdateRoleRequestDto, RoleRequestOrmEntity, RoleRequestsModule, RoleRequestService, RoleRequestView, toView() (+1 more)

### Community 25 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+11 more)

### Community 26 - "AuthController"
Cohesion: 0.30
Nodes (3): Public(), AuthController, AuthResponseDto

### Community 27 - "package.json"
Cohesion: 0.11
Nodes (17): name, private, version, class-transformer, jest, @nestjs/cli, @nestjs/platform-express, pg (+9 more)

### Community 28 - "RxSoft Identity Agent"
Cohesion: 0.25
Nodes (7): Architecture, DB, Key commands, Modules, Overview, RxSoft Identity Agent, Token payload

### Community 35 - "@nestjs/swagger"
Cohesion: 0.18
Nodes (3): class-validator, @nestjs/swagger, ProvisionTemplate

### Community 38 - "provision.service.ts"
Cohesion: 0.15
Nodes (16): DEFAULT_ORG_DEPARTMENTS, DEFAULT_ORGANIZATION_ID, DepartmentTemplate, LOCATION_HQ_CODE, LOCATION_HQ_NAME, LOCATION_STORE_SUFFIX, ORG_TEMPLATE_ROLES, ORG_TEMPLATE_USERS (+8 more)

### Community 45 - "auth.controller.ts"
Cohesion: 0.17
Nodes (11): MeResponse, WebsiteForgotPasswordDto, WebsiteOAuthDto, WebsiteRequestEmailVerificationDto, WebsiteRequestOtpDto, WebsiteResetPasswordDto, WebsiteVerifyEmailDto, WebsiteVerifyOtpDto (+3 more)

### Community 48 - "Backend CRUD Resource — rxsoft-identity"
Cohesion: 0.25
Nodes (7): Backend CRUD Resource — rxsoft-identity, Inputs, Purpose, Refactoring, When not to invoke, When to invoke, Workflow

### Community 49 - "Backend List Endpoint — rxsoft-identity"
Cohesion: 0.25
Nodes (7): Backend List Endpoint — rxsoft-identity, Inputs, Purpose, Refactoring consistency, When not to invoke, When to invoke, Workflow

### Community 53 - "Auth Guard — rxsoft-identity"
Cohesion: 0.40
Nodes (4): Auth Guard — rxsoft-identity, Purpose, Refactoring, When to invoke

### Community 54 - "Seeding — rxsoft-identity"
Cohesion: 0.33
Nodes (5): Purpose, Refactoring, Seeding — rxsoft-identity, When to invoke, Workflow

### Community 58 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, jest, @nestjs/cli, supertest, ts-jest, @types/jest, @types/node, @types/supertest (+1 more)

### Community 60 - "roles.controller.ts"
Cohesion: 0.31
Nodes (3): ROLES_KEY, UserWithRoles, RoleResponseDto

### Community 67 - "Refactoring deviations (fix when touching)"
Cohesion: 0.29
Nodes (7): Auth, Clean-ish architecture, List endpoints (WORST — largely unimplemented), Refactoring deviations (fix when touching), Schema, Seeding, Tests

### Community 77 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, start, start:dev, start:prod, test, test:watch

### Community 78 - "permissions.controller.ts"
Cohesion: 0.47
Nodes (3): PermissionModuleResponseDto, MODULE_PERMISSIONS, ModulePermissionDefinition

### Community 80 - "nest-cli.json"
Cohesion: 0.50
Nodes (3): collection, $schema, sourceRoot

### Community 81 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): ./tsconfig.json, exclude, extends

## Knowledge Gaps
- **146 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `name`, `version` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 520 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `auth.module.ts` to `create-location.use-case.ts`, `jwt-auth.guard.ts`, `@nestjs/swagger`, `CurrentUser`, `provision.service.ts`, `locations.controller.ts`, `auth.controller.ts`, `permissions.controller.ts`, `organizations.controller.ts`, `permissions.guard.ts`, `users.controller.ts`, `role-requests.module.ts`, `package.json`, `roles.controller.ts`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CreateUserDto` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Why does `RequestUser` connect `RequestUser` to `Roles`, `CurrentUser`, `locations.controller.ts`, `auth.controller.ts`, `organizations.controller.ts`, `.list`, `role-requests.module.ts`, `users.controller.ts`, `.me`, `roles.controller.ts`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `RegisterDto` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `CurrentUser` connect `CurrentUser` to `Roles`, `RequestUser`, `locations.controller.ts`, `auth.controller.ts`, `organizations.controller.ts`, `.list`, `role-requests.module.ts`, `users.controller.ts`, `.me`, `roles.controller.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Should `User` be split into smaller, more focused modules?**
  _Cohesion score 0.08687943262411348 - nodes in this community are weakly interconnected._