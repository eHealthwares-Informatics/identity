import type { RoleRepository } from '../repositories/role.repository';
export declare class DeleteRoleUseCase {
    private readonly roleRepository;
    constructor(roleRepository: RoleRepository);
    execute(id: string, organizationId: string): Promise<void>;
}
