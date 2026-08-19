import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORG_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../repositories/organization.repository';

@Injectable()
export class DeleteOrganizationUseCase {
  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.organizationRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Organization not found');
    }
    await this.organizationRepository.delete(id);
  }
}