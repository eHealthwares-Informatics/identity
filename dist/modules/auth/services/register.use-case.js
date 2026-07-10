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
exports.RegisterUseCase = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const user_entity_1 = require("../../users/domains/user.entity");
const identity_di_tokens_1 = require("./identity.di-tokens");
const login_use_case_1 = require("./login.use-case");
let RegisterUseCase = class RegisterUseCase {
    constructor(userRepository, roleRepository, passwordHasher, loginUseCase) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordHasher = passwordHasher;
        this.loginUseCase = loginUseCase;
    }
    async execute(payload) {
        const existing = await this.userRepository.findByUsername(payload.username);
        if (existing) {
            throw new common_1.BadRequestException('Username already exists');
        }
        const defaultOrgId = 'df3b4afd-9955-4617-9a82-264cc73dd8b2';
        const roleCodes = ['website_user'];
        const roles = await this.roleRepository.listByCodes(roleCodes, defaultOrgId);
        if (roles.length !== roleCodes.length) {
            throw new common_1.BadRequestException('Website user role not configured');
        }
        const passwordHash = await this.passwordHasher.hash(payload.password);
        const user = new user_entity_1.User((0, node_crypto_1.randomUUID)(), defaultOrgId, null, payload.username, passwordHash, true, roleCodes, roles, payload.phone, payload.email);
        await this.userRepository.create(user);
        return this.loginUseCase.execute({ username: payload.username, password: payload.password });
    }
};
exports.RegisterUseCase = RegisterUseCase;
exports.RegisterUseCase = RegisterUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(identity_di_tokens_1.USER_REPOSITORY)),
    __param(1, (0, common_1.Inject)(identity_di_tokens_1.ROLE_REPOSITORY)),
    __param(2, (0, common_1.Inject)(identity_di_tokens_1.PASSWORD_HASHER)),
    __metadata("design:paramtypes", [Object, Object, Object, login_use_case_1.LoginUseCase])
], RegisterUseCase);
//# sourceMappingURL=register.use-case.js.map