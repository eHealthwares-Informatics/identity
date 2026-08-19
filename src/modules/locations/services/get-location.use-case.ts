import { Inject, Injectable } from '@nestjs/common';
import { LOCATION_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { LocationRepository } from '../repositories/location.repository';

@Injectable()
export class GetLocationUseCase {
  constructor(
    @Inject(LOCATION_REPOSITORY)
    private readonly locationRepository: LocationRepository,
  ) {}

  execute(id: string, organizationId: string) {
    return this.locationRepository.findById(id, organizationId);
  }
}
