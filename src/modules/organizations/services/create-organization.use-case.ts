import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ORG_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../repositories/organization.repository';
import { Organization } from '../domains/organization.entity';
import type { CreateOrganizationDto } from '../dto/create-organization.dto';

@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {
    this.logger = new Logger(CreateOrganizationUseCase.name);
  }

  private readonly logger: Logger;

  async execute(payload: CreateOrganizationDto): Promise<Organization> {
    this.logger.log(`Create organization attempt: code=${payload.code} name=${payload.name}`);
    const existing = await this.organizationRepository.findByCode(payload.code);
    if (existing) {
      this.logger.warn(`Create organization failed: code=${payload.code} already exists`);
      throw new BadRequestException('Organization code already exists');
    }

    const organization = new Organization(
      randomUUID(),
      payload.code,
      payload.name,
      payload.isActive ?? true,
    );
    const saved = await this.organizationRepository.create(organization);
    this.logger.log(`Organization created: id=${saved.id} code=${payload.code}`);
    return saved;
  }
}