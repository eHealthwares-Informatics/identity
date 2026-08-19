import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ORG_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../repositories/organization.repository';
import { Organization } from '../domains/organization.entity';
import type { UpdateOrganizationDto } from '../dto/update-organization.dto';

@Injectable()
export class UpdateOrganizationUseCase {
  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async execute(id: string, payload: UpdateOrganizationDto): Promise<Organization> {
    const existing = await this.organizationRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Organization not found');
    }

    const code = payload.code ?? existing.code;
    const conflicting = await this.organizationRepository.findByCode(code);
    if (conflicting && conflicting.id !== id) {
      throw new BadRequestException('Organization code already exists');
    }

    const updated = new Organization(
      id,
      code,
      payload.name ?? existing.name,
      payload.isActive ?? existing.isActive,
    );
    return this.organizationRepository.update(updated);
  }
}