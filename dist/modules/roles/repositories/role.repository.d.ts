import { Role } from '../domains/role.entity';
export interface RoleRepository {
    findByCode(code: string, organizationId: string): Promise<Role | null>;
    findById(id: string, organizationId: string): Promise<Role | null>;
    listByCodes(codes: string[], organizationId: string): Promise<Role[]>;
    listAll(organizationId: string): Promise<Role[]>;
    create(role: Role): Promise<Role>;
    update(role: Role): Promise<Role>;
    delete(id: string, organizationId: string): Promise<void>;
    findLastCreated(organizationId: string): Promise<Pick<Role, 'code'> | null>;
}
