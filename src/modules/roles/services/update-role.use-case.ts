import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateRoleDto } from '../dto/update-role.dto';
import type { RoleRepository } from '../repositories/role.repository';
import { Role } from '../domains/role.entity';
import { ROLE_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, payload: UpdateRoleDto, organizationId: string): Promise<Role> {
    const existing = await this.roleRepository.findById(id, organizationId);
    if (!existing) throw new NotFoundException('Role not found');

    const updated = new Role(
      id,
      organizationId,
      payload.code ?? existing.code,
      payload.name ?? existing.name,
      payload.description ?? existing.description,
      payload.permissionCodes ?? existing.permissionCodes,
    );

    return this.roleRepository.update(updated);
  }
}
