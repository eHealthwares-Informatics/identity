import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
  ) {}

  async execute(payload: CreateLocationDto, organizationId: string): Promise<Location> {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required to create a location');
    }

    const existing = await this.locationRepository.findByCode(payload.code, organizationId);
    if (existing) {
      throw new BadRequestException('Location code already exists for this organisation');
    }

    let parentId: string | null = null;
    if (payload.parentId) {
      const parent = await this.locationRepository.findById(payload.parentId, organizationId);
      if (!parent) {
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
    return this.locationRepository.create(location);
  }
}