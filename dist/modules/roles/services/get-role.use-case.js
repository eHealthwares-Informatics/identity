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
exports.GetRoleUseCase = void 0;
const common_1 = require("@nestjs/common");
const identity_di_tokens_1 = require("../../auth/services/identity.di-tokens");
let GetRoleUseCase = class GetRoleUseCase {
    constructor(roleRepository) {
        this.roleRepository = roleRepository;
    }
    async execute(id, organizationId) {
        const role = await this.roleRepository.findById(id, organizationId);
        if (!role)
            throw new common_1.NotFoundException('Role not found');
        return role;
    }
};
exports.GetRoleUseCase = GetRoleUseCase;
exports.GetRoleUseCase = GetRoleUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(identity_di_tokens_1.ROLE_REPOSITORY)),
    __metadata("design:paramtypes", [Object])
], GetRoleUseCase);
//# sourceMappingURL=get-role.use-case.js.map