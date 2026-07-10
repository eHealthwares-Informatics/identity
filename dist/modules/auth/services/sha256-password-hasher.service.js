"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sha256PasswordHasherService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
let Sha256PasswordHasherService = class Sha256PasswordHasherService {
    async hash(raw) {
        return (0, node_crypto_1.createHash)('sha256').update(raw).digest('hex');
    }
    async verify(raw, digest) {
        const hashed = await this.hash(raw);
        return hashed === digest;
    }
};
exports.Sha256PasswordHasherService = Sha256PasswordHasherService;
exports.Sha256PasswordHasherService = Sha256PasswordHasherService = __decorate([
    (0, common_1.Injectable)()
], Sha256PasswordHasherService);
//# sourceMappingURL=sha256-password-hasher.service.js.map