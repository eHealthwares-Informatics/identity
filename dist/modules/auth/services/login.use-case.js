"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginUseCase = void 0;
const common_1 = require("@nestjs/common");
const identity_di_tokens_1 = require("./identity.di-tokens");
let LoginUseCase = class LoginUseCase {
    constructor(userRepository, roleRepository, passwordHasher, tokenIssuer, refreshTokenRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordHasher = passwordHasher;
        this.tokenIssuer = tokenIssuer;
        this.refreshTokenRepository = refreshTokenRepository;
    }
    async execute(payload) {
        const user = await this.userRepository.findByUsername(payload.username);
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isValid = await this.passwordHasher.verify(payload.password, user.passwordHash);
        if (!isValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const roles = user.organizationId
            ? await this.roleRepository.listByCodes(user.roleCodes, user.organizationId)
            : [];
        const permissions = [...new Set(roles.flatMap((role) => role.permissionCodes))];
        const tokenPair = await this.tokenIssuer.issuePair({
            sub: user.id,
            organizationId: user.organizationId ?? '',
            locationId: user.locationId,
            username: user.username,
            roles: user.roleCodes,
            permissions,
            phone: user.phone,
            email: user.email ?? user.id,
        });
        const refreshTokenHash = await this.passwordHasher.hash(tokenPair.refreshToken);
        await this.refreshTokenRepository.persist(user.id, refreshTokenHash, new Date(Date.now() + tokenPair.refreshTokenExpiresIn * 1000));
        return tokenPair;
    }
};
exports.LoginUseCase = LoginUseCase;
exports.LoginUseCase = LoginUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(identity_di_tokens_1.USER_REPOSITORY)),
    __param(1, (0, common_1.Inject)(identity_di_tokens_1.ROLE_REPOSITORY)),
    __param(2, (0, common_1.Inject)(identity_di_tokens_1.PASSWORD_HASHER)),
    __param(3, (0, common_1.Inject)(identity_di_tokens_1.TOKEN_ISSUER)),
    __param(4, (0, common_1.Inject)(identity_di_tokens_1.REFRESH_TOKEN_REPOSITORY)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object])
], LoginUseCase);
//# sourceMappingURL=login.use-case.js.map