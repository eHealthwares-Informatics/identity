import { Location } from '../domains/location.entity';

export type LocationListOptions = {
  offset: number;
  limit: number;
  organizationId: string;
  search?: string;
};

export interface LocationRepository {
  list(options: LocationListOptions): Promise<{ items: Location[]; total: number }>;
  findById(id: string, organizationId: string): Promise<Location | null>;
}
