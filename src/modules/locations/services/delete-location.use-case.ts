import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LOCATION_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { LocationRepository } from '../repositories/location.repository';

@Injectable()
export class DeleteLocationUseCase {
  constructor(
    @Inject(LOCATION_REPOSITORY)
    private readonly locationRepository: LocationRepository,
  ) {}

  async execute(id: string, organizationId: string): Promise<void> {
    const existing = await this.locationRepository.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundException('Location not found');
    }

    const children = await this.locationRepository.countChildren(id);
    if (children > 0) {
      throw new BadRequestException('Location has child locations; move or remove them first');
    }

    await this.locationRepository.delete(id);
  }
}