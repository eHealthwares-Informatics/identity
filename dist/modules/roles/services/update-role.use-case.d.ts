import { UpdateRoleDto } from '../dto/update-role.dto';
import type { RoleRepository } from '../repositories/role.repository';
import { Role } from '../domains/role.entity';
export declare class UpdateRoleUseCase {
    private readonly roleRepository;
    constructor(roleRepository: RoleRepository);
    execute(id: string, payload: UpdateRoleDto, organizationId: string): Promise<Role>;
}
