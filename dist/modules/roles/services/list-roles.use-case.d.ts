import type { RoleRepository } from '../repositories/role.repository';
export declare class ListRolesUseCase {
    private readonly roleRepository;
    constructor(roleRepository: RoleRepository);
    execute(organizationId: string): Promise<import("../domains/role.entity").Role[]>;
}
