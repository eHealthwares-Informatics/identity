import { Inject, Injectable } from '@nestjs/common';
import type { RoleRepository } from '../repositories/role.repository';
import { ROLE_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class ListRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(organizationId: string) {
    return this.roleRepository.listAll(organizationId);
  }
}
