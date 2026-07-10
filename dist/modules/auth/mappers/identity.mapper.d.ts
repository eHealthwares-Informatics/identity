import { User } from '../../users/domains/user.entity';
import { Role } from '../../roles/domains/role.entity';
import { Permission } from '../../roles/domains/permission.entity';
import { UserOrmEntity } from '../../users/entities/user.orm-entity';
import { RoleOrmEntity } from '../../roles/entities/role.orm-entity';
import { PermissionOrmEntity } from '../../roles/entities/permission.orm-entity';
export declare class IdentityMapper {
    static toDomainPermission(orm: PermissionOrmEntity): Permission;
    static toDomainRole(orm: RoleOrmEntity): Role;
    static toDomainUser(orm: UserOrmEntity): User;
}
