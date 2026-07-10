import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RoleRepository } from '../repositories/role.repository';
import { ROLE_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class GetRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, organizationId: string) {
    const role = await this.roleRepository.findById(id, organizationId);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
}
