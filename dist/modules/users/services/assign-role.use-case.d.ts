import { AssignRoleDto } from '../dto/assign-role.dto';
import type { UserRepository } from '../repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
export declare class AssignRoleUseCase {
    private readonly userRepository;
    private readonly roleRepository;
    constructor(userRepository: UserRepository, roleRepository: RoleRepository);
    execute(userId: string, payload: AssignRoleDto, organizationId: string): Promise<import("../domains/user.entity").User>;
}
