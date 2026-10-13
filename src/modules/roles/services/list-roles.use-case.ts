import { Inject, Injectable } from '@nestjs/common';
import type { RoleListQuery, RoleRepository } from '../repositories/role.repository';
import { ROLE_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class ListRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  /** Unpaginated lookup used by the role catalog/request pickers. */
  async execute(organizationId: string) {
    return this.roleRepository.listAll(organizationId);
  }

  /** Paginated + searchable list for the roles admin table. */
  async list(query: RoleListQuery) {
    return this.roleRepository.list(query);
  }
}
