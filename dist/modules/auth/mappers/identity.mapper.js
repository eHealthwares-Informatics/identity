"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityMapper = void 0;
const user_entity_1 = require("../../users/domains/user.entity");
const role_entity_1 = require("../../roles/domains/role.entity");
const permission_entity_1 = require("../../roles/domains/permission.entity");
class IdentityMapper {
    static toDomainPermission(orm) {
        return new permission_entity_1.Permission(orm.id, orm.code, orm.resource, orm.action, orm.description);
    }
    static toDomainRole(orm) {
        const permissionCodes = (orm.permissions ?? []).map((p) => p.code);
        return new role_entity_1.Role(orm.id, orm.organizationId, orm.code, orm.name, orm.description, permissionCodes);
    }
    static toDomainUser(orm) {
        const roleCodes = (orm.roles ?? []).map((r) => r.code);
        return new user_entity_1.User(orm.id, orm.organizationId, orm.locationId, orm.username, orm.passwordHash, orm.isActive, roleCodes, orm.roles, orm.phone, orm.email);
    }
}
exports.IdentityMapper = IdentityMapper;
//# sourceMappingURL=identity.mapper.js.map