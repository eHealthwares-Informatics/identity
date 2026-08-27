import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LOCATION_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { LocationRepository } from '../repositories/location.repository';
import { Location } from '../domains/location.entity';
import type { UpdateLocationDto } from '../dto/update-location.dto';

@Injectable()
export class UpdateLocationUseCase {
  constructor(
    @Inject(LOCATION_REPOSITORY)
    private readonly locationRepository: LocationRepository,
  ) {}

  async execute(
    id: string,
    payload: UpdateLocationDto,
    organizationId: string,
  ): Promise<Location> {
    const existing = await this.locationRepository.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundException('Location not found');
    }

    const code = payload.code ?? existing.code;
    if (payload.code && payload.code !== existing.code) {
      const byCode = await this.locationRepository.findByCode(payload.code, organizationId);
      if (byCode && byCode.id !== id) {
        throw new BadRequestException('Location code already exists for this organisation');
      }
    }

    const newParentId = payload.parentId !== undefined ? payload.parentId : existing.parentId;
    if (newParentId) {
      if (newParentId === id) {
        throw new BadRequestException('A location cannot be its own parent');
      }
      const parent = await this.locationRepository.findById(newParentId, organizationId);
      if (!parent) {
        throw new BadRequestException('Parent location not found in this organisation');
      }
      // Reject cycles: walking up from the proposed parent must never reach `id`.
      let cursor = parent.parentId;
      while (cursor) {
        if (cursor === id) {
          throw new BadRequestException('Cannot set parent: would create a cycle');
        }
        const ancestor = await this.locationRepository.findById(cursor, organizationId);
        cursor = ancestor?.parentId ?? null;
      }
    }

    const location = new Location(
      existing.id,
      existing.organizationId,
      code,
      payload.name ?? existing.name,
      newParentId,
      payload.isActive ?? existing.isActive,
    );
    return this.locationRepository.update(location);
  }
}