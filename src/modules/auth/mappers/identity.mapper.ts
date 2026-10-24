import { User, type UserProfile } from '../../users/domains/user.entity';
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
      orm.loginTimeoutMinutes,
      {
        firstName: orm.firstName ?? null,
        lastName: orm.lastName ?? null,
        displayName: orm.displayName ?? null,
        dateOfBirth: orm.dateOfBirth ?? null,
        gender: orm.gender ?? null,
        pictureUrl: orm.pictureUrl ?? null,
        locale: orm.locale ?? null,
        oauthProvider: orm.oauthProvider ?? null,
        oauthProviderId: orm.oauthProviderId ?? null,
        emailVerifiedAt: orm.emailVerifiedAt ?? null,
      },
    );
  }

  /**
   * Profile columns shared by the create/update persistence paths. Only keys
   * the domain object actually carries are returned, so a partial profile
   * (e.g. an admin edit that never touches these fields) leaves the stored
   * columns untouched instead of clearing them.
   */
  static profileColumns(profile: UserProfile = {}): Partial<UserOrmEntity> {
    const columns: Partial<UserOrmEntity> = {};
    const assign = (
      column: keyof UserOrmEntity,
      value: string | Date | null | undefined,
    ) => {
      if (value !== undefined) {
        (columns as Record<string, unknown>)[column] = value;
      }
    };
    assign('firstName', profile.firstName);
    assign('lastName', profile.lastName);
    assign('displayName', profile.displayName);
    assign('dateOfBirth', profile.dateOfBirth);
    assign('gender', profile.gender);
    assign('pictureUrl', profile.pictureUrl);
    assign('locale', profile.locale);
    assign('oauthProvider', profile.oauthProvider);
    assign('oauthProviderId', profile.oauthProviderId);
    assign('emailVerifiedAt', profile.emailVerifiedAt);
    return columns;
  }
}
