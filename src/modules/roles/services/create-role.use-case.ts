import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateRoleDto } from '../dto/create-role.dto';
import type { RoleRepository } from '../repositories/role.repository';
import { Role } from '../domains/role.entity';
import { ROLE_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class CreateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(payload: CreateRoleDto, organizationId: string): Promise<Role> {
    const existing = await this.roleRepository.findByCode(payload.code, organizationId);
    if (existing) {
      throw new BadRequestException('Role code already exists');
    }

    const role = new Role(
      randomUUID(),
      organizationId,
      payload.code,
      payload.name,
      payload.description ?? null,
      payload.permissionCodes ?? [],
    );

    return this.roleRepository.create(role);
  }
}
