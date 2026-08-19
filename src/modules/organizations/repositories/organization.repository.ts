import { Organization } from '../domains/organization.entity';

export type OrganizationListOptions = {
  offset: number;
  limit: number;
  search?: string;
};

export interface OrganizationRepository {
  list(options: OrganizationListOptions): Promise<{ items: Organization[]; total: number }>;
  findAll(): Promise<Organization[]>;
  findById(id: string): Promise<Organization | null>;
  findByCode(code: string): Promise<Organization | null>;
  create(organization: Organization): Promise<Organization>;
  update(organization: Organization): Promise<Organization>;
  delete(id: string): Promise<void>;
}