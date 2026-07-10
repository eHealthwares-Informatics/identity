import { CreateRoleDto } from '../dto/create-role.dto';
import type { RoleRepository } from '../repositories/role.repository';
import { Role } from '../domains/role.entity';
export declare class CreateRoleUseCase {
    private readonly roleRepository;
    constructor(roleRepository: RoleRepository);
    execute(payload: CreateRoleDto, organizationId: string): Promise<Role>;
}
