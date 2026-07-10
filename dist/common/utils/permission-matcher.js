"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionMatches = permissionMatches;
function permissionMatches(userPerm, requiredCode) {
    if (userPerm === '*')
        return true;
    const userParts = userPerm.split('.');
    const requiredParts = requiredCode.split('.');
    for (let i = 0; i < userParts.length; i++) {
        if (userParts[i] === '*') {
            if (i === userParts.length - 1)
                return true;
            continue;
        }
        if (i >= requiredParts.length)
            return false;
        if (userParts[i] !== requiredParts[i])
            return false;
    }
    return userParts.length === requiredParts.length;
}
//# sourceMappingURL=permission-matcher.js.map