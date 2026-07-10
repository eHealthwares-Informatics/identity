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
exports.UpdateRoleUseCase = void 0;
const common_1 = require("@nestjs/common");
const role_entity_1 = require("../domains/role.entity");
const identity_di_tokens_1 = require("../../auth/services/identity.di-tokens");
let UpdateRoleUseCase = class UpdateRoleUseCase {
    constructor(roleRepository) {
        this.roleRepository = roleRepository;
    }
    async execute(id, payload, organizationId) {
        const existing = await this.roleRepository.findById(id, organizationId);
        if (!existing)
            throw new common_1.NotFoundException('Role not found');
        const updated = new role_entity_1.Role(id, organizationId, payload.code ?? existing.code, payload.name ?? existing.name, payload.description ?? existing.description, payload.permissionCodes ?? existing.permissionCodes);
        return this.roleRepository.update(updated);
    }
};
exports.UpdateRoleUseCase = UpdateRoleUseCase;
exports.UpdateRoleUseCase = UpdateRoleUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(identity_di_tokens_1.ROLE_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], UpdateRoleUseCase);
//# sourceMappingURL=update-role.use-case.js.map