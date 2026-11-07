import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UpdateRoleDto } from '../dto/update-role.dto';
import type { RoleRepository } from '../repositories/role.repository';
import { Role } from '../domains/role.entity';
import { ROLE_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {
    this.logger = new Logger(UpdateRoleUseCase.name);
  }

  private readonly logger: Logger;

  async execute(id: string, payload: UpdateRoleDto, organizationId: string): Promise<Role> {
    this.logger.log(`Update role attempt: id=${id} organizationId=${organizationId}`);
    const existing = await this.roleRepository.findById(id, organizationId);
    if (!existing) {
      this.logger.warn(`Role not found: id=${id} organizationId=${organizationId}`);
      throw new NotFoundException('Role not found');
    }

    const updated = new Role(
      id,
      organizationId,
      payload.code ?? existing.code,
      payload.name ?? existing.name,
      payload.description ?? existing.description,
      payload.permissionCodes ?? existing.permissionCodes,
    );

    const saved = await this.roleRepository.update(updated);
    this.logger.log(`Role updated: id=${id} organizationId=${organizationId}`);
    return saved;
  }
}
