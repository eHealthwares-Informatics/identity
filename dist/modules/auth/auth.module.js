"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const auth_controller_1 = require("./controllers/auth.controller");
const login_use_case_1 = require("./services/login.use-case");
const refresh_token_use_case_1 = require("./services/refresh-token.use-case");
const register_use_case_1 = require("./services/register.use-case");
const jwt_token_issuer_service_1 = require("./services/jwt-token-issuer.service");
const sha256_password_hasher_service_1 = require("./services/sha256-password-hasher.service");
const typeorm_refresh_token_repository_1 = require("./repositories/typeorm-refresh-token.repository");
const typeorm_user_repository_1 = require("../users/repositories/typeorm-user.repository");
const typeorm_role_repository_1 = require("../roles/repositories/typeorm-role.repository");
const refresh_token_orm_entity_1 = require("./entities/refresh-token.orm-entity");
const user_orm_entity_1 = require("../users/entities/user.orm-entity");
const role_orm_entity_1 = require("../roles/entities/role.orm-entity");
const permission_orm_entity_1 = require("../roles/entities/permission.orm-entity");
const identity_di_tokens_1 = require("./services/identity.di-tokens");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.register({}),
            typeorm_1.TypeOrmModule.forFeature([refresh_token_orm_entity_1.RefreshTokenOrmEntity, user_orm_entity_1.UserOrmEntity, role_orm_entity_1.RoleOrmEntity, permission_orm_entity_1.PermissionOrmEntity]),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            login_use_case_1.LoginUseCase,
            refresh_token_use_case_1.RefreshTokenUseCase,
            register_use_case_1.RegisterUseCase,
            jwt_auth_guard_1.JwtAuthGuard,
            roles_guard_1.RolesGuard,
            typeorm_user_repository_1.TypeormUserRepository,
            typeorm_role_repository_1.TypeormRoleRepository,
            typeorm_refresh_token_repository_1.TypeormRefreshTokenRepository,
            { provide: identity_di_tokens_1.USER_REPOSITORY, useExisting: typeorm_user_repository_1.TypeormUserRepository },
            { provide: identity_di_tokens_1.ROLE_REPOSITORY, useExisting: typeorm_role_repository_1.TypeormRoleRepository },
            { provide: identity_di_tokens_1.REFRESH_TOKEN_REPOSITORY, useExisting: typeorm_refresh_token_repository_1.TypeormRefreshTokenRepository },
            { provide: identity_di_tokens_1.PASSWORD_HASHER, useClass: sha256_password_hasher_service_1.Sha256PasswordHasherService },
            { provide: identity_di_tokens_1.TOKEN_ISSUER, useClass: jwt_token_issuer_service_1.JwtTokenIssuerService },
        ],
        exports: [jwt_1.JwtModule, jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, identity_di_tokens_1.USER_REPOSITORY, identity_di_tokens_1.ROLE_REPOSITORY, identity_di_tokens_1.TOKEN_ISSUER, identity_di_tokens_1.PASSWORD_HASHER],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map