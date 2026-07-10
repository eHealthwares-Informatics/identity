import { Inject, Injectable } from '@nestjs/common';
import type { RoleRepository } from '../repositories/role.repository';
import { ROLE_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class DeleteRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, organizationId: string): Promise<void> {
    await this.roleRepository.delete(id, organizationId);
  }
}
