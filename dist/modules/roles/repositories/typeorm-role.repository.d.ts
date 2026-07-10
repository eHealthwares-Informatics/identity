import { Repository } from 'typeorm';
import { RoleRepository } from './role.repository';
import { Role } from '../domains/role.entity';
import { RoleOrmEntity } from '../entities/role.orm-entity';
import { PermissionOrmEntity } from '../entities/permission.orm-entity';
export declare class TypeormRoleRepository implements RoleRepository {
    private readonly roleRepository;
    private readonly permissionRepository;
    constructor(roleRepository: Repository<RoleOrmEntity>, permissionRepository: Repository<PermissionOrmEntity>);
    findLastCreated(organizationId: string): Promise<Pick<Role, 'code'> | null>;
    findByCode(code: string, organizationId: string): Promise<Role | null>;
    findById(id: string, organizationId: string): Promise<Role | null>;
    listByCodes(codes: string[], organizationId: string): Promise<Role[]>;
    listAll(organizationId: string): Promise<Role[]>;
    create(role: Role): Promise<Role>;
    update(role: Role): Promise<Role>;
    delete(id: string, organizationId: string): Promise<void>;
}
