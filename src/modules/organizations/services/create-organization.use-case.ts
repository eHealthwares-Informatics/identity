import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
  ) {}

  async execute(payload: CreateOrganizationDto): Promise<Organization> {
    const existing = await this.organizationRepository.findByCode(payload.code);
    if (existing) {
      throw new BadRequestException('Organization code already exists');
    }

    const organization = new Organization(
      randomUUID(),
      payload.code,
      payload.name,
      payload.isActive ?? true,
    );
    return this.organizationRepository.create(organization);
  }
}