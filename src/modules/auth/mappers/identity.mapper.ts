import { User } from '../../users/domains/user.entity';
import { Role } from '../../roles/domains/role.entity';
import { Permission } from '../../roles/domains/permission.entity';
import { UserOrmEntity } from '../../users/entities/user.orm-entity';
import { RoleOrmEntity } from '../../roles/entities/role.orm-entity';
import { PermissionOrmEntity } from '../../roles/entities/permission.orm-entity';

export class IdentityMapper {
  static toDomainPermission(orm: PermissionOrmEntity): Permission {
    return new Permission(orm.id, orm.code, orm.resource, orm.action, orm.description);
  }

  static toDomainRole(orm: RoleOrmEntity): Role {
    const permissionCodes = (orm.permissions ?? []).map((p: PermissionOrmEntity) => p.code);
    return new Role(orm.id, orm.organizationId, orm.code, orm.name, orm.description, permissionCodes);
  }

  static toDomainUser(orm: UserOrmEntity): User {
    const roleCodes = (orm.roles ?? []).map((r: RoleOrmEntity) => r.code);
    return new User(
      orm.id,
      orm.organizationId,
      orm.locationId,
      orm.username,
      orm.passwordHash,
      orm.isActive,
      roleCodes,
      orm.roles,
      orm.phone,
      orm.email,
    );
  }
}
