import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ORG_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../repositories/organization.repository';
import { Organization } from '../domains/organization.entity';
import type { UpdateOrganizationDto } from '../dto/update-organization.dto';

@Injectable()
export class UpdateOrganizationUseCase {
  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {
    this.logger = new Logger(UpdateOrganizationUseCase.name);
  }

  private readonly logger: Logger;

  async execute(id: string, payload: UpdateOrganizationDto): Promise<Organization> {
    this.logger.log(`Update organization attempt: id=${id} name=${payload.name ?? '<unchanged>'}`);
    const existing = await this.organizationRepository.findById(id);
    if (!existing) {
      this.logger.warn(`Organization not found: id=${id}`);
      throw new NotFoundException('Organization not found');
    }

    const code = payload.code ?? existing.code;
    const conflicting = await this.organizationRepository.findByCode(code);
    if (conflicting && conflicting.id !== id) {
      this.logger.warn(`Update organization failed: code=${code} already exists`);
      throw new BadRequestException('Organization code already exists');
    }

    const updated = new Organization(
      id,
      code,
      payload.name ?? existing.name,
      payload.isActive ?? existing.isActive,
    );
    const saved = await this.organizationRepository.update(updated);
    this.logger.log(`Organization updated: id=${id} code=${code}`);
    return saved;
  }
}