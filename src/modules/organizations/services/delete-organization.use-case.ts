import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ORG_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../repositories/organization.repository';

@Injectable()
export class DeleteOrganizationUseCase {
  private readonly logger = new Logger(DeleteOrganizationUseCase.name);

  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.log(`Delete organization attempt: id=${id}`);
    const existing = await this.organizationRepository.findById(id);
    if (!existing) {
      this.logger.warn(`Organization not found: id=${id}`);
      throw new NotFoundException('Organization not found');
    }
    await this.organizationRepository.delete(id);
    this.logger.log(`Organization deleted: id=${id} code=${existing.code}`);
  }
}