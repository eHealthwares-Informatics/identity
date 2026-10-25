import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LOCATION_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { LocationRepository } from '../repositories/location.repository';

@Injectable()
export class DeleteLocationUseCase {
  private readonly logger = new Logger(DeleteLocationUseCase.name);

  constructor(
    @Inject(LOCATION_REPOSITORY)
    private readonly locationRepository: LocationRepository,
  ) {}

  async execute(id: string, organizationId: string): Promise<void> {
    this.logger.log(`Delete location attempt: id=${id} organizationId=${organizationId}`);
    const existing = await this.locationRepository.findById(id, organizationId);
    if (!existing) {
      this.logger.warn(`Location not found: id=${id} organizationId=${organizationId}`);
      throw new NotFoundException('Location not found');
    }

    const children = await this.locationRepository.countChildren(id);
    if (children > 0) {
      this.logger.warn(
        `Delete location failed: id=${id} has ${children} child locations`,
      );
      throw new BadRequestException('Location has child locations; move or remove them first');
    }

    await this.locationRepository.delete(id);
    this.logger.log(`Location deleted: id=${id} organizationId=${organizationId}`);
  }
}