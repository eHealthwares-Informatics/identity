import { Inject, Injectable } from '@nestjs/common';
import { ORG_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../repositories/organization.repository';

@Injectable()
export class ListOrganizationsUseCase {
  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  execute(offset: number, limit: number, search?: string) {
    return this.organizationRepository.list({ offset, limit, search });
  }
}