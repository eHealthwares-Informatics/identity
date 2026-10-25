import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RoleRepository } from '../repositories/role.repository';
import { ROLE_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class DeleteRoleUseCase {
  private readonly logger = new Logger(DeleteRoleUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, organizationId: string): Promise<void> {
    this.logger.log(`Delete role attempt: id=${id} organizationId=${organizationId}`);
    await this.roleRepository.delete(id, organizationId);
    this.logger.log(`Role deleted: id=${id} organizationId=${organizationId}`);
  }
}
