"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const users_controller_1 = require("./controllers/users.controller");
const create_user_use_case_1 = require("./services/create-user.use-case");
const update_user_use_case_1 = require("./services/update-user.use-case");
const delete_user_use_case_1 = require("./services/delete-user.use-case");
const list_users_use_case_1 = require("./services/list-users.use-case");
const assign_role_use_case_1 = require("./services/assign-role.use-case");
const user_orm_entity_1 = require("./entities/user.orm-entity");
const auth_module_1 = require("../auth/auth.module");
let UsersModule = class UsersModule {
};
exports.UsersModule = UsersModule;
exports.UsersModule = UsersModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([user_orm_entity_1.UserOrmEntity]), auth_module_1.AuthModule],
        controllers: [users_controller_1.UsersController],
        providers: [
            create_user_use_case_1.CreateUserUseCase,
            update_user_use_case_1.UpdateUserUseCase,
            delete_user_use_case_1.DeleteUserUseCase,
            list_users_use_case_1.ListUsersUseCase,
            assign_role_use_case_1.AssignRoleUseCase,
        ],
    })
], UsersModule);
//# sourceMappingURL=users.module.js.map