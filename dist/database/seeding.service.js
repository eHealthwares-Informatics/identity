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
var DatabaseSeedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseSeedService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const seed_identity_1 = require("./seeds/seed-identity");
let DatabaseSeedService = DatabaseSeedService_1 = class DatabaseSeedService {
    constructor(configService, dataSource) {
        this.configService = configService;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(DatabaseSeedService_1.name);
    }
    async runSeedsOnStartup() {
        const shouldSeed = this.configService.get('SEED_ON_START', 'true') === 'true';
        if (!shouldSeed)
            return;
        try {
            this.logger.log('Seeding database...');
            await (0, seed_identity_1.seedIdentity)(this.dataSource);
            this.logger.log('Seeding complete');
        }
        catch (error) {
            this.logger.error('Seeding failed:', error);
        }
    }
};
exports.DatabaseSeedService = DatabaseSeedService;
exports.DatabaseSeedService = DatabaseSeedService = DatabaseSeedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_1.DataSource])
], DatabaseSeedService);
//# sourceMappingURL=seeding.service.js.map