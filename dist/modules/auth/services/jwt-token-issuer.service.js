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
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtTokenIssuerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
let JwtTokenIssuerService = class JwtTokenIssuerService {
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.accessTokenExpiresIn = 15 * 60;
        this.refreshTokenExpiresIn = 7 * 24 * 60 * 60;
    }
    async issuePair(payload, loginTimeoutMinutes) {
        const accessExpiresIn = loginTimeoutMinutes ? loginTimeoutMinutes * 60 : this.accessTokenExpiresIn;
        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('JWT_ACCESS_SECRET', 'admin-access-secret'),
            expiresIn: accessExpiresIn,
        });
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET', 'admin-refresh-secret'),
            expiresIn: this.refreshTokenExpiresIn,
        });
        return {
            accessToken,
            refreshToken,
            accessTokenExpiresIn: accessExpiresIn,
            refreshTokenExpiresIn: this.refreshTokenExpiresIn,
        };
    }
    async verifyRefreshToken(token) {
        try {
            return await this.jwtService.verifyAsync(token, {
                secret: this.configService.get('JWT_REFRESH_SECRET', 'admin-refresh-secret'),
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
};
exports.JwtTokenIssuerService = JwtTokenIssuerService;
exports.JwtTokenIssuerService = JwtTokenIssuerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], JwtTokenIssuerService);
//# sourceMappingURL=jwt-token-issuer.service.js.map