import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../domains/location.entity';
import { LocationOrmEntity } from '../entities/location.orm-entity';
import { LocationRepository, LocationListOptions } from './location.repository';

@Injectable()
export class TypeormLocationRepository implements LocationRepository {
  constructor(
    @InjectRepository(LocationOrmEntity)
    private readonly locationRepository: Repository<LocationOrmEntity>,
  ) {}

  private toDomain(entity: LocationOrmEntity): Location {
    return new Location(
      entity.id,
      entity.organizationId,
      entity.code,
      entity.name,
      entity.parentId,
      entity.isActive,
    );
  }

  async list({
    offset,
    limit,
    organizationId,
    search,
  }: LocationListOptions): Promise<{ items: Location[]; total: number }> {
    const qb = this.locationRepository
      .createQueryBuilder('location')
      .where('location.deleted_at IS NULL');

    if (organizationId) {
      qb.andWhere(
        '(location.organization_id = :orgId OR location.organization_id IS NULL)',
        { orgId: organizationId },
      );
    }

    if (search) {
      qb.andWhere('(location.name ILIKE :search OR location.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [items, total] = await qb
      .orderBy('location.name', 'ASC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { items: items.map((entity) => this.toDomain(entity)), total };
  }

  async findById(id: string, organizationId: string): Promise<Location | null> {
    const qb = this.locationRepository
      .createQueryBuilder('location')
      .where('location.id = :id', { id })
      .andWhere('location.deleted_at IS NULL');

    if (organizationId) {
      qb.andWhere(
        '(location.organization_id = :orgId OR location.organization_id IS NULL)',
        { orgId: organizationId },
      );
    }

    const entity = await qb.getOne();
    return entity ? this.toDomain(entity) : null;
  }
}
