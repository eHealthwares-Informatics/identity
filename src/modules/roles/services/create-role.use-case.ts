import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
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
  ) {
    this.logger = new Logger(CreateRoleUseCase.name);
  }

  private readonly logger: Logger;

  async execute(payload: CreateRoleDto, organizationId: string): Promise<Role> {
    this.logger.log(`Create role attempt: code=${payload.code} organizationId=${organizationId}`);
    const existing = await this.roleRepository.findByCode(payload.code, organizationId);
    if (existing) {
      this.logger.warn(`Create role failed: code=${payload.code} already exists in org=${organizationId}`);
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

    const saved = await this.roleRepository.create(role);
    this.logger.log(`Role created: id=${saved.id} code=${payload.code} organizationId=${organizationId}`);
    return saved;
  }
}
