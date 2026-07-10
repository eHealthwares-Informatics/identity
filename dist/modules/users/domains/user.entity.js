"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
class User {
    constructor(id, organizationId, locationId, username, passwordHash, isActive, roleCodes = [], roles = [], phone, email) {
        this.id = id;
        this.organizationId = organizationId;
        this.locationId = locationId;
        this.username = username;
        this.passwordHash = passwordHash;
        this.isActive = isActive;
        this.roleCodes = roleCodes;
        this.roles = roles;
        this.phone = phone;
        this.email = email;
    }
}
exports.User = User;
//# sourceMappingURL=user.entity.js.map