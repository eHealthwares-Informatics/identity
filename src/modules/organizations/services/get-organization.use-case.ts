import { Inject, Injectable } from '@nestjs/common';
import { ORG_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../repositories/organization.repository';

@Injectable()
export class GetOrganizationUseCase {
  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  execute(id: string) {
    return this.organizationRepository.findById(id);
  }
}