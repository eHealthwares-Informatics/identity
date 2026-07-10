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
exports.TypeormRoleRepository = void 0;
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const typeorm_2 = require("typeorm");
const role_orm_entity_1 = require("../entities/role.orm-entity");
const permission_orm_entity_1 = require("../entities/permission.orm-entity");
const identity_mapper_1 = require("../../auth/mappers/identity.mapper");
let TypeormRoleRepository = class TypeormRoleRepository {
    constructor(roleRepository, permissionRepository) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
    }
    async findLastCreated(organizationId) {
        const role = await this.roleRepository.findOne({
            where: { organizationId },
            order: { createdAt: 'DESC' },
            select: ['code'],
        });
        return role ? { code: role.code } : null;
    }
    async findByCode(code, organizationId) {
        const item = await this.roleRepository.findOne({
            where: { code, organizationId },
            relations: { permissions: true },
        });
        return item ? identity_mapper_1.IdentityMapper.toDomainRole(item) : null;
    }
    async findById(id, organizationId) {
        const item = await this.roleRepository.findOne({
            where: { id, organizationId },
            relations: { permissions: true },
        });
        return item ? identity_mapper_1.IdentityMapper.toDomainRole(item) : null;
    }
    async listByCodes(codes, organizationId) {
        if (!codes.length)
            return [];
        const items = await this.roleRepository.find({
            where: codes.map((code) => ({ code, organizationId })),
            relations: { permissions: true },
        });
        return items.map(identity_mapper_1.IdentityMapper.toDomainRole.bind(identity_mapper_1.IdentityMapper));
    }
    async listAll(organizationId) {
        const items = await this.roleRepository.find({
            where: { organizationId },
            relations: { permissions: true },
            order: { code: 'ASC' },
        });
        return items.map(identity_mapper_1.IdentityMapper.toDomainRole.bind(identity_mapper_1.IdentityMapper));
    }
    async create(role) {
        const permissions = role.permissionCodes.length
            ? await this.permissionRepository.findBy({ code: (0, typeorm_2.In)(role.permissionCodes) })
            : [];
        const orm = this.roleRepository.create({
            id: role.id,
            organizationId: role.organizationId,
            code: role.code,
            name: role.name,
            description: role.description ?? null,
            permissions,
        });
        const saved = await this.roleRepository.save(orm);
        return identity_mapper_1.IdentityMapper.toDomainRole(saved);
    }
    async update(role) {
        const orm = await this.roleRepository.findOne({
            where: { id: role.id },
            relations: { permissions: true },
        });
        if (!orm)
            throw new common_1.NotFoundException('Role not found');
        orm.code = role.code;
        orm.name = role.name;
        orm.description = role.description ?? null;
        if (role.permissionCodes) {
            const permissions = role.permissionCodes.length
                ? await this.permissionRepository.findBy({ code: (0, typeorm_2.In)(role.permissionCodes) })
                : [];
            orm.permissions = permissions;
        }
        const saved = await this.roleRepository.save(orm);
        return identity_mapper_1.IdentityMapper.toDomainRole(saved);
    }
    async delete(id, organizationId) {
        const orm = await this.roleRepository.findOne({ where: { id, organizationId } });
        if (!orm)
            throw new common_1.NotFoundException('Role not found');
        await this.roleRepository.remove(orm);
    }
};
exports.TypeormRoleRepository = TypeormRoleRepository;
exports.TypeormRoleRepository = TypeormRoleRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(role_orm_entity_1.RoleOrmEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(permission_orm_entity_1.PermissionOrmEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], TypeormRoleRepository);
//# sourceMappingURL=typeorm-role.repository.js.map