"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const roles_controller_1 = require("./controllers/roles.controller");
const permissions_controller_1 = require("./controllers/permissions.controller");
const create_role_use_case_1 = require("./services/create-role.use-case");
const list_roles_use_case_1 = require("./services/list-roles.use-case");
const get_role_use_case_1 = require("./services/get-role.use-case");
const update_role_use_case_1 = require("./services/update-role.use-case");
const delete_role_use_case_1 = require("./services/delete-role.use-case");
const role_orm_entity_1 = require("./entities/role.orm-entity");
const permission_orm_entity_1 = require("./entities/permission.orm-entity");
const auth_module_1 = require("../auth/auth.module");
let RolesModule = class RolesModule {
};
exports.RolesModule = RolesModule;
exports.RolesModule = RolesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([role_orm_entity_1.RoleOrmEntity, permission_orm_entity_1.PermissionOrmEntity]), auth_module_1.AuthModule],
        controllers: [roles_controller_1.RolesController, permissions_controller_1.PermissionsController],
        providers: [
            create_role_use_case_1.CreateRoleUseCase,
            list_roles_use_case_1.ListRolesUseCase,
            get_role_use_case_1.GetRoleUseCase,
            update_role_use_case_1.UpdateRoleUseCase,
            delete_role_use_case_1.DeleteRoleUseCase,
        ],
    })
], RolesModule);
//# sourceMappingURL=roles.module.js.map