import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LOCATION_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { LocationRepository } from '../repositories/location.repository';
import { Location } from '../domains/location.entity';
import type { UpdateLocationDto } from '../dto/update-location.dto';

@Injectable()
export class UpdateLocationUseCase {
  constructor(
    @Inject(LOCATION_REPOSITORY)
    private readonly locationRepository: LocationRepository,
  ) {
    this.logger = new Logger(UpdateLocationUseCase.name);
  }

  private readonly logger: Logger;

  async execute(
    id: string,
    payload: UpdateLocationDto,
    organizationId: string,
  ): Promise<Location> {
    this.logger.log(`Update location attempt: id=${id} organizationId=${organizationId}`);
    const existing = await this.locationRepository.findById(id, organizationId);
    if (!existing) {
      this.logger.warn(`Location not found: id=${id} organizationId=${organizationId}`);
      throw new NotFoundException('Location not found');
    }

    const code = payload.code ?? existing.code;
    if (payload.code && payload.code !== existing.code) {
      const byCode = await this.locationRepository.findByCode(payload.code, organizationId);
      if (byCode && byCode.id !== id) {
        this.logger.warn(
          `Update location failed: code=${payload.code} already exists in org=${organizationId}`,
        );
        throw new BadRequestException('Location code already exists for this organisation');
      }
    }

    const newParentId = payload.parentId !== undefined ? payload.parentId : existing.parentId;
    if (newParentId) {
      if (newParentId === id) {
        this.logger.warn(`Update location failed: id=${id} cannot be its own parent`);
        throw new BadRequestException('A location cannot be its own parent');
      }
      const parent = await this.locationRepository.findById(newParentId, organizationId);
      if (!parent) {
        this.logger.warn(`Update location failed: parent not found id=${newParentId} org=${organizationId}`);
        throw new BadRequestException('Parent location not found in this organisation');
      }
      // Reject cycles: walking up from the proposed parent must never reach `id`.
      let cursor = parent.parentId;
      while (cursor) {
        if (cursor === id) {
          this.logger.warn(`Update location failed: id=${id} would create a parent cycle`);
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
    const saved = await this.locationRepository.update(location);
    this.logger.log(`Location updated: id=${id} organizationId=${organizationId}`);
    return saved;
  }
}