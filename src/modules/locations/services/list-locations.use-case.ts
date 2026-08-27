import { Inject, Injectable } from '@nestjs/common';
import { LOCATION_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { LocationRepository } from '../repositories/location.repository';

@Injectable()
export class ListLocationsUseCase {
  constructor(
    @Inject(LOCATION_REPOSITORY)
    private readonly locationRepository: LocationRepository,
  ) {}

  execute(
    offset: number,
    limit: number,
    organizationId: string,
    search?: string,
    parentId?: string,
  ) {
    return this.locationRepository.list({ offset, limit, organizationId, search, parentId });
  }
}
