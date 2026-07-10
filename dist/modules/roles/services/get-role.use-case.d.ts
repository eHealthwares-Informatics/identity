import type { RoleRepository } from '../repositories/role.repository';
export declare class GetRoleUseCase {
    private readonly roleRepository;
    constructor(roleRepository: RoleRepository);
    execute(id: string, organizationId: string): Promise<import("../domains/role.entity").Role>;
}
