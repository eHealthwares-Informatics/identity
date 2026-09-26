# Graph Report - identity  (2026-09-23)

## Corpus Check
- 136 files · ~25,595 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1041 nodes · 2335 edges · 76 communities (58 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

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
- AuthController
- WebsiteAuthService
- RxSoft Identity Agent
- provision.module.ts
- auth.module.ts
- ProvisionController
- ProvisionOrganisationDto
- .shopperVerifyOtp
- role-requests.module.ts
- CreateUserDto
- UserLoginEventOrmEntity
- ProvisionService
- provision.service.ts
- RxSoft Identity
- update-organization.use-case.ts
- OnboardOrganisationDto
- ShopperAuthService
- OrganizationOrmEntity
- UpdateUserDto
- WebsiteRequestOtpDto
- PhoneOtpOrmEntity
- CreateRoleRequestDto
- Backend CRUD Resource — rxsoft-identity
- Backend List Endpoint — rxsoft-identity
- CreateOrganizationDto
- RawUpsertTarget
- .assignRole
- Auth Guard — rxsoft-identity
- Seeding — rxsoft-identity
- ApiOperation
- RefreshTokenDto
- LogoutAllDto
- RoleRequestService
- UpdateRoleDto
- Sha256PasswordHasherService
- nest-cli.json
- dependencies
- tsconfig.build.json
- RxSoft Identity Service
- .constructor
- .constructor
- .constructor
- Auth Module
- Locations Module
- LoginUseCase
- Organizations Module
- RoleOrmEntity
- Roles Module
- TenantContext Helper
- Users Module

## God Nodes (most connected - your core abstractions)
1. `RoleRepository` - 38 edges
2. `UserRepository` - 38 edges
3. `User` - 35 edges
4. `RequestUser` - 34 edges
5. `CurrentUser` - 33 edges
6. `PasswordHasherPort` - 27 edges
7. `Role` - 27 edges
8. `RefreshTokenRepository` - 25 edges
9. `UserOrmEntity` - 24 edges
10. `Organization` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Yarn Configuration (.yarnrc.yml)` --references--> `RxSoft Identity Service`  [INFERRED]
  .yarnrc.yml → AGENTS.md
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  src/main.ts → src/app.module.ts
- `TypeormRefreshTokenRepository` --implements--> `RefreshTokenRepository`  [EXTRACTED]
  src/modules/auth/repositories/typeorm-refresh-token.repository.ts → src/modules/auth/repositories/refresh-token.repository.ts
- `Sha256PasswordHasherService` --implements--> `PasswordHasherPort`  [EXTRACTED]
  src/modules/auth/services/sha256-password-hasher.service.ts → src/modules/auth/services/password-hasher.port.ts
- `TypeormUserRepository` --implements--> `UserRepository`  [EXTRACTED]
  src/modules/users/repositories/typeorm-user.repository.ts → src/modules/users/repositories/user.repository.ts

## Import Cycles
- None detected.

## Communities (76 total, 18 thin omitted)

### Community 0 - "Auth Token Management"
Cohesion: 0.15
Nodes (13): Inject, UsersListResponse, CreateUserUseCase, Inject, Injectable, DeleteUserUseCase, Inject, Injectable (+5 more)

### Community 1 - "Auth Controller & Guards"
Cohesion: 0.08
Nodes (21): MeResponse, ApiProperty, LoginDto, ApiProperty, IsNotEmpty, IsString, MinLength, RegisterDto (+13 more)

### Community 2 - "Database Seed & User Entity"
Cohesion: 0.11
Nodes (17): AppModule, Module, bootstrap(), AuthModule, Module, LocationsModule, Module, OrganizationsModule (+9 more)

### Community 3 - "User Request Decorators"
Cohesion: 0.12
Nodes (19): ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, Body, Controller, Delete, Get (+11 more)

### Community 4 - "Create User DTO"
Cohesion: 0.05
Nodes (26): JoinColumn, ManyToOne, OneToMany, RefreshTokenOrmEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn (+18 more)

### Community 5 - "Project Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, class-transformer, class-validator, @nestjs/common, @nestjs/config, @nestjs/core, @nestjs/jwt, @nestjs/platform-express (+26 more)

### Community 6 - "Roles Controller"
Cohesion: 0.11
Nodes (19): RolesController, toResponse(), ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, Body, Controller (+11 more)

### Community 7 - "Roles Update & Delete"
Cohesion: 0.16
Nodes (12): CreateRoleUseCase, Inject, Injectable, DeleteRoleUseCase, Inject, Injectable, GetRoleUseCase, Injectable (+4 more)

### Community 8 - "Locations Controller"
Cohesion: 0.19
Nodes (18): CurrentUser, RequestUser, LocationsController, ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, Body (+10 more)

### Community 9 - "Organizations Controller"
Cohesion: 0.16
Nodes (17): OrganizationsController, ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, Body, Controller, Delete (+9 more)

### Community 10 - "TypeScript Configuration"
Cohesion: 0.06
Nodes (37): LOCATION_REPOSITORY, LocationResponse, LocationsListResponse, Location, CreateLocationDto, ApiProperty, ApiPropertyOptional, IsBoolean (+29 more)

### Community 11 - "Role Repository"
Cohesion: 0.11
Nodes (8): IdentityMapper, Role, RoleRepository, Injectable, TypeormRoleRepository, Inject, Inject, Inject

### Community 12 - "Permission Mapping & Entity"
Cohesion: 0.10
Nodes (18): Permission, PermissionOrmEntity, Column, CreateDateColumn, Entity, ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn (+10 more)

### Community 13 - "Refresh Token Repository"
Cohesion: 0.14
Nodes (6): Organization, OrganizationListOptions, OrganizationRepository, Injectable, TypeormOrganizationRepository, Inject

### Community 14 - "Roles Guard & Decorators"
Cohesion: 0.31
Nodes (4): Roles(), RolesGuard, Injectable, UserWithRoles

### Community 15 - "Role Repository & Mapper"
Cohesion: 0.21
Nodes (8): LoginUseCase, Inject, Injectable, InjectRepository, PasswordHasherPort, Inject, UserRepository, Inject

### Community 16 - "Permissions Controller"
Cohesion: 0.11
Nodes (13): Public(), JwtAuthGuard, Injectable, PermissionsController, ApiBearerAuth, ApiOperation, ApiTags, Controller (+5 more)

### Community 17 - "Create Role DTO & Use Case"
Cohesion: 0.29
Nodes (7): CreateRoleDto, ApiProperty, ApiPropertyOptional, IsArray, IsNotEmpty, IsOptional, IsString

### Community 18 - "Role ORM Entity"
Cohesion: 0.20
Nodes (10): ORG_REPOSITORY, OrganizationsListResponse, CreateOrganizationUseCase, Injectable, DeleteOrganizationUseCase, Injectable, GetOrganizationUseCase, Injectable (+2 more)

### Community 19 - "Permissions Guard & Matcher"
Cohesion: 0.24
Nodes (4): PermissionsGuard, Injectable, UserWithPermissions, permissionMatches()

### Community 20 - "JWT Token Issuer"
Cohesion: 0.12
Nodes (11): RefreshTokenRepository, JwtTokenIssuerService, Injectable, LogoutAllUseCase, Inject, Injectable, LogoutUseCase, Inject (+3 more)

### Community 21 - "System Architecture Overview"
Cohesion: 0.20
Nodes (9): Architecture, Commands, Database, JWT, Modules, rxsoft-identity, Setup, Tenant scoping (+1 more)

### Community 23 - "Nest CLI Configuration"
Cohesion: 0.18
Nodes (14): RoleRequestsController, ApiBearerAuth, ApiOperation, ApiTags, Body, Controller, Get, Param (+6 more)

### Community 25 - "TypeScript Build Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+12 more)

### Community 26 - "AuthController"
Cohesion: 0.27
Nodes (10): Headers, Public, AuthController, ApiTags, Body, Controller, HttpCode, Post (+2 more)

### Community 27 - "WebsiteAuthService"
Cohesion: 0.24
Nodes (3): TokenPair, Injectable, WebsiteAuthService

### Community 28 - "RxSoft Identity Agent"
Cohesion: 0.12
Nodes (15): Architecture, Auth, Auth, Clean-ish architecture, DB, Key commands, List endpoints (WORST — largely unimplemented), Modules (+7 more)

### Community 29 - "provision.module.ts"
Cohesion: 0.13
Nodes (12): InjectDataSource, LocationOrmEntity, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, Unique (+4 more)

### Community 30 - "auth.module.ts"
Cohesion: 0.40
Nodes (7): PASSWORD_HASHER, REFRESH_TOKEN_REPOSITORY, ROLE_REPOSITORY, TOKEN_ISSUER, USER_REPOSITORY, OAuthProvider, OAuthUserInfo

### Community 31 - "ProvisionController"
Cohesion: 0.17
Nodes (10): ProvisionController, ApiOperation, ApiTags, Body, Controller, Delete, Get, HttpCode (+2 more)

### Community 32 - "ProvisionOrganisationDto"
Cohesion: 0.14
Nodes (13): IsObject, ProvisionOrganisationDto, ProvisionTemplate, ApiProperty, ApiPropertyOptional, IsEmail, IsIn, IsNotEmpty (+5 more)

### Community 33 - ".shopperVerifyOtp"
Cohesion: 0.18
Nodes (6): ShopperRequestOtpDto, ShopperVerifyOtpDto, ApiProperty, IsIn, IsNotEmpty, IsString

### Community 34 - "role-requests.module.ts"
Cohesion: 0.18
Nodes (10): RoleRequestOrmEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, InjectRepository, AssignRoleUseCase (+2 more)

### Community 35 - "CreateUserDto"
Cohesion: 0.15
Nodes (12): ArrayNotEmpty, CreateUserDto, ApiProperty, ApiPropertyOptional, IsArray, IsEmail, IsInt, IsNotEmpty (+4 more)

### Community 36 - "UserLoginEventOrmEntity"
Cohesion: 0.17
Nodes (11): InjectRepository, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UserLoginEventOrmEntity, RefreshTokenUseCase (+3 more)

### Community 37 - "ProvisionService"
Cohesion: 0.26
Nodes (4): Inject, InjectRepository, ProvisionService, Injectable

### Community 38 - "provision.service.ts"
Cohesion: 0.23
Nodes (9): DEFAULT_ORG_DEPARTMENTS, DepartmentTemplate, ORG_TEMPLATE_ROLES, ORG_TEMPLATE_USERS, RoleTemplate, UserTemplate, ProvisionedUser, ProvisionResult (+1 more)

### Community 39 - "RxSoft Identity"
Cohesion: 0.17
Nodes (11): Architecture, Commands, Database, Environment Variables, JWT Token Payload, Modules, Quick Start, RxSoft Identity (+3 more)

### Community 40 - "update-organization.use-case.ts"
Cohesion: 0.18
Nodes (9): ApiPropertyOptional, IsBoolean, IsOptional, IsString, MaxLength, UpdateOrganizationDto, Inject, Injectable (+1 more)

### Community 41 - "OnboardOrganisationDto"
Cohesion: 0.18
Nodes (11): OnboardOrganisationDto, ApiProperty, ApiPropertyOptional, IsEmail, IsNotEmpty, IsOptional, IsString, Length (+3 more)

### Community 42 - "ShopperAuthService"
Cohesion: 0.20
Nodes (6): ConversationClient, Injectable, ShopperAuthService, Inject, Injectable, InjectRepository

### Community 43 - "OrganizationOrmEntity"
Cohesion: 0.18
Nodes (9): OrganizationOrmEntity, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn (+1 more)

### Community 44 - "UpdateUserDto"
Cohesion: 0.20
Nodes (9): ApiPropertyOptional, IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, MinLength (+1 more)

### Community 45 - "WebsiteRequestOtpDto"
Cohesion: 0.39
Nodes (8): ApiProperty, IsIn, IsNotEmpty, IsOptional, IsString, WebsiteOAuthDto, WebsiteRequestOtpDto, WebsiteVerifyOtpDto

### Community 46 - "PhoneOtpOrmEntity"
Cohesion: 0.22
Nodes (8): PhoneOtpOrmEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Inject, InjectRepository

### Community 47 - "CreateRoleRequestDto"
Cohesion: 0.31
Nodes (8): CreateRoleRequestDto, ApiProperty, ApiPropertyOptional, IsIn, IsOptional, IsString, Length, UpdateRoleRequestDto

### Community 48 - "Backend CRUD Resource — rxsoft-identity"
Cohesion: 0.25
Nodes (7): Backend CRUD Resource — rxsoft-identity, Inputs, Purpose, Refactoring, When not to invoke, When to invoke, Workflow

### Community 49 - "Backend List Endpoint — rxsoft-identity"
Cohesion: 0.25
Nodes (7): Backend List Endpoint — rxsoft-identity, Inputs, Purpose, Refactoring consistency, When not to invoke, When to invoke, Workflow

### Community 50 - "CreateOrganizationDto"
Cohesion: 0.25
Nodes (8): CreateOrganizationDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength

### Community 52 - ".assignRole"
Cohesion: 0.33
Nodes (4): AssignRoleDto, ApiProperty, IsNotEmpty, IsString

### Community 53 - "Auth Guard — rxsoft-identity"
Cohesion: 0.33
Nodes (5): Auth Guard — rxsoft-identity, Purpose, Refactoring, When to invoke, Workflow

### Community 54 - "Seeding — rxsoft-identity"
Cohesion: 0.33
Nodes (5): Purpose, Refactoring, Seeding — rxsoft-identity, When to invoke, Workflow

### Community 55 - "ApiOperation"
Cohesion: 0.53
Nodes (4): ApiBearerAuth, ApiOperation, Get, UseGuards

### Community 56 - "RefreshTokenDto"
Cohesion: 0.40
Nodes (4): RefreshTokenDto, ApiProperty, IsNotEmpty, IsString

### Community 57 - "LogoutAllDto"
Cohesion: 0.33
Nodes (5): LogoutAllDto, ApiPropertyOptional, IsNotEmpty, IsOptional, IsString

### Community 58 - "RoleRequestService"
Cohesion: 0.40
Nodes (3): RoleRequestService, toView(), Injectable

### Community 59 - "UpdateRoleDto"
Cohesion: 0.33
Nodes (5): ApiPropertyOptional, IsArray, IsOptional, IsString, UpdateRoleDto

### Community 61 - "nest-cli.json"
Cohesion: 0.50
Nodes (3): collection, $schema, sourceRoot

## Knowledge Gaps
- **132 isolated node(s):** `@opencode-ai/plugin`, `$schema`, `collection`, `sourceRoot`, `name` (+127 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequestUser` connect `Locations Controller` to `Auth Token Management`, `Auth Controller & Guards`, `User Request Decorators`, `Roles Controller`, `Roles Update & Delete`, `Organizations Controller`, `TypeScript Configuration`, `Roles Guard & Decorators`, `Role ORM Entity`, `Nest CLI Configuration`, `.assignRole`, `ApiOperation`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `CurrentUser` connect `Locations Controller` to `Auth Token Management`, `Auth Controller & Guards`, `User Request Decorators`, `Roles Controller`, `Roles Update & Delete`, `Organizations Controller`, `TypeScript Configuration`, `Roles Guard & Decorators`, `Role ORM Entity`, `Nest CLI Configuration`, `.assignRole`, `ApiOperation`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `RoleRepository` connect `Role Repository` to `Auth Token Management`, `role-requests.module.ts`, `Roles Update & Delete`, `ShopperAuthService`, `Permission Mapping & Entity`, `PhoneOtpOrmEntity`, `Role Repository & Mapper`, `auth.module.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `@opencode-ai/plugin`, `$schema`, `collection` to the rest of the system?**
  _132 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth Token Management` be split into smaller, more focused modules?**
  _Cohesion score 0.14761904761904762 - nodes in this community are weakly interconnected._
- **Should `Auth Controller & Guards` be split into smaller, more focused modules?**
  _Cohesion score 0.0846774193548387 - nodes in this community are weakly interconnected._
- **Should `Database Seed & User Entity` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._