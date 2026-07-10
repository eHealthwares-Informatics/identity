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
exports.TypeormRefreshTokenRepository = void 0;
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const typeorm_2 = require("typeorm");
const refresh_token_orm_entity_1 = require("../entities/refresh-token.orm-entity");
const user_orm_entity_1 = require("../../users/entities/user.orm-entity");
let TypeormRefreshTokenRepository = class TypeormRefreshTokenRepository {
    constructor(refreshTokenRepository, userRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
    }
    async persist(userId, tokenHash, expiresAt) {
        const user = await this.userRepository.findOneByOrFail({ id: userId });
        const entity = this.refreshTokenRepository.create({
            user,
            tokenHash,
            expiresAt,
            revokedAt: null,
        });
        await this.refreshTokenRepository.save(entity);
    }
    async isValid(userId, tokenHash) {
        const item = await this.refreshTokenRepository.findOne({
            where: {
                user: { id: userId },
                tokenHash,
                revokedAt: (0, typeorm_2.IsNull)(),
                expiresAt: (0, typeorm_2.MoreThan)(new Date()),
            },
            relations: { user: true },
        });
        return Boolean(item);
    }
    async revoke(userId, tokenHash) {
        await this.refreshTokenRepository.update({
            user: { id: userId },
            tokenHash,
            revokedAt: (0, typeorm_2.IsNull)(),
        }, {
            revokedAt: new Date(),
        });
    }
};
exports.TypeormRefreshTokenRepository = TypeormRefreshTokenRepository;
exports.TypeormRefreshTokenRepository = TypeormRefreshTokenRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(refresh_token_orm_entity_1.RefreshTokenOrmEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(user_orm_entity_1.UserOrmEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], TypeormRefreshTokenRepository);
//# sourceMappingURL=typeorm-refresh-token.repository.js.map