import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LOCATION_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { LocationRepository } from '../repositories/location.repository';
import { Location } from '../domains/location.entity';
import type { CreateLocationDto } from '../dto/create-location.dto';

@Injectable()
export class CreateLocationUseCase {
  constructor(
    @Inject(LOCATION_REPOSITORY)
    private readonly locationRepository: LocationRepository,
  ) {
    this.logger = new Logger(CreateLocationUseCase.name);
  }

  private readonly logger: Logger;

  async execute(payload: CreateLocationDto, organizationId: string): Promise<Location> {
    this.logger.log(`Create location attempt: code=${payload.code} name=${payload.name} organizationId=${organizationId}`);
    if (!organizationId) {
      this.logger.warn(`Create location failed: organizationId is required`);
      throw new BadRequestException('organizationId is required to create a location');
    }

    const existing = await this.locationRepository.findByCode(payload.code, organizationId);
    if (existing) {
      this.logger.warn(`Create location failed: code=${payload.code} already exists in org=${organizationId}`);
      throw new BadRequestException('Location code already exists for this organisation');
    }

    let parentId: string | null = null;
    if (payload.parentId) {
      const parent = await this.locationRepository.findById(payload.parentId, organizationId);
      if (!parent) {
        this.logger.warn(`Create location failed: parent location not found id=${payload.parentId} org=${organizationId}`);
        throw new BadRequestException('Parent location not found in this organisation');
      }
      parentId = parent.id;
    }

    const location = new Location(
      randomUUID(),
      organizationId,
      payload.code,
      payload.name,
      parentId,
      payload.isActive ?? true,
    );
    const saved = await this.locationRepository.create(location);
    this.logger.log(`Location created: id=${saved.id} code=${payload.code} organizationId=${organizationId}`);
    return saved;
  }
}