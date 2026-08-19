import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Organization } from '../domains/organization.entity';
import { OrganizationOrmEntity } from '../entities/organization.orm-entity';
import { OrganizationRepository, OrganizationListOptions } from './organization.repository';

@Injectable()
export class TypeormOrganizationRepository implements OrganizationRepository {
  constructor(
    @InjectRepository(OrganizationOrmEntity)
    private readonly organizationRepository: Repository<OrganizationOrmEntity>,
  ) {}

  private toDomain(entity: OrganizationOrmEntity): Organization {
    return new Organization(entity.id, entity.code, entity.name, entity.isActive);
  }

  async list({
    offset,
    limit,
    search,
  }: OrganizationListOptions): Promise<{ items: Organization[]; total: number }> {
    const qb = this.organizationRepository
      .createQueryBuilder('organization')
      .where('organization.deleted_at IS NULL');

    if (search) {
      qb.andWhere('(organization.name ILIKE :search OR organization.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [items, total] = await qb
      .orderBy('organization.name', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { items: items.map((entity) => this.toDomain(entity)), total };
  }

  async findAll(): Promise<Organization[]> {
    const items = await this.organizationRepository.find({
      where: { deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
    return items.map((entity) => this.toDomain(entity));
  }

  async findById(id: string): Promise<Organization | null> {
    const entity = await this.organizationRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCode(code: string): Promise<Organization | null> {
    const entity = await this.organizationRepository.findOne({
      where: { code, deletedAt: IsNull() },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async create(organization: Organization): Promise<Organization> {
    const entity = this.organizationRepository.create({
      id: organization.id,
      code: organization.code,
      name: organization.name,
      isActive: organization.isActive,
    });
    const saved = await this.organizationRepository.save(entity);
    return this.toDomain(saved);
  }

  async update(organization: Organization): Promise<Organization> {
    const existing = await this.organizationRepository.findOneOrFail({
      where: { id: organization.id },
    });
    existing.code = organization.code;
    existing.name = organization.name;
    existing.isActive = organization.isActive;
    const saved = await this.organizationRepository.save(existing);
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.organizationRepository.findOne({ where: { id } });
    if (existing) {
      await this.organizationRepository.softRemove(existing);
    }
  }
}