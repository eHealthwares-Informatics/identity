"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
class Role {
    constructor(id, organizationId, code, name, description, permissionCodes = [], permissions = []) {
        this.id = id;
        this.organizationId = organizationId;
        this.code = code;
        this.name = name;
        this.description = description;
        this.permissionCodes = permissionCodes;
        this.permissions = permissions;
    }
}
exports.Role = Role;
//# sourceMappingURL=role.entity.js.map