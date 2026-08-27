import { Location } from '../domains/location.entity';

export type LocationListOptions = {
  offset: number;
  limit: number;
  organizationId: string;
  search?: string;
  parentId?: string;
};

export interface LocationRepository {
  list(options: LocationListOptions): Promise<{ items: Location[]; total: number }>;
  findById(id: string, organizationId: string): Promise<Location | null>;
  findByCode(code: string, organizationId: string): Promise<Location | null>;
  countChildren(id: string): Promise<number>;
  create(location: Location): Promise<Location>;
  update(location: Location): Promise<Location>;
  delete(id: string): Promise<void>;
}