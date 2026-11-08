import { Inject, Injectable, Logger } from '@nestjs/common';
import { ORG_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../repositories/organization.repository';

@Injectable()
export class ResolveOrganizationByDomainUseCase {
  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {
    this.logger = new Logger(ResolveOrganizationByDomainUseCase.name);
  }

  private readonly logger: Logger;

  async execute(domain: string): Promise<{ id: string; code: string; name: string } | null> {
    this.logger.debug(`Resolve organization by domain: domain=${domain}`);
    const organization = await this.organizationRepository.findByDomain(domain);
    if (!organization) {
      this.logger.debug(`No organization found for domain: domain=${domain}`);
      return null;
    }
    return {
      id: organization.id,
      code: organization.code,
      name: organization.name,
    };
  }
}
