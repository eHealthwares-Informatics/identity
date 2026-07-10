"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const roles_module_1 = require("./modules/roles/roles.module");
const organizations_module_1 = require("./modules/organizations/organizations.module");
const locations_module_1 = require("./modules/locations/locations.module");
const seeding_service_1 = require("./database/seeding.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const type = config.get('DB_TYPE', 'postgres');
                    return {
                        type,
                        host: type === 'postgres' ? config.get('DB_HOST', 'localhost') : undefined,
                        port: type === 'postgres' ? Number(config.get('DB_PORT', '5432')) : undefined,
                        username: type === 'postgres' ? config.get('DB_USER', 'postgres') : undefined,
                        password: type === 'postgres' ? config.get('DB_PASSWORD', 'postgres') : undefined,
                        database: config.get('DB_NAME', 'identity'),
                        autoLoadEntities: true,
                        synchronize: config.get('DB_SYNCHRONIZE', 'true') === 'true',
                        dropSchema: config.get('DB_DROP_SCHEMA', 'false') === 'true',
                        logging: config.get('TYPEORM_LOGGING', 'false') === 'true',
                    };
                },
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            roles_module_1.RolesModule,
            organizations_module_1.OrganizationsModule,
            locations_module_1.LocationsModule,
        ],
        providers: [seeding_service_1.DatabaseSeedService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map