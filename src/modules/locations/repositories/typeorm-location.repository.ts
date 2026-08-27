import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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

  private applyOrgScope(
    qb: import('typeorm').SelectQueryBuilder<LocationOrmEntity>,
    organizationId: string,
  ) {
    if (organizationId) {
      qb.andWhere(
        '(location.organization_id = :orgId OR location.organization_id IS NULL)',
        { orgId: organizationId },
      );
    }
  }

  async list({
    offset,
    limit,
    organizationId,
    search,
    parentId,
  }: LocationListOptions): Promise<{ items: Location[]; total: number }> {
    const qb = this.locationRepository
      .createQueryBuilder('location')
      .where('location.deleted_at IS NULL');

    this.applyOrgScope(qb, organizationId);

    if (parentId !== undefined) {
      qb.andWhere(
        parentId
          ? 'location.parent_id = :parentId'
          : 'location.parent_id IS NULL',
        { parentId },
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

    this.applyOrgScope(qb, organizationId);

    const entity = await qb.getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async findByCode(code: string, organizationId: string): Promise<Location | null> {
    const qb = this.locationRepository
      .createQueryBuilder('location')
      .where('location.code = :code', { code })
      .andWhere('location.deleted_at IS NULL');

    this.applyOrgScope(qb, organizationId);

    const entity = await qb.getOne();
    return entity ? this.toDomain(entity) : null;
  }

  async countChildren(id: string): Promise<number> {
    return this.locationRepository.count({ where: { parentId: id, deletedAt: IsNull() } });
  }

  async create(location: Location): Promise<Location> {
    const entity = this.locationRepository.create({
      id: location.id,
      organizationId: location.organizationId,
      code: location.code,
      name: location.name,
      parentId: location.parentId,
      isActive: location.isActive,
    });
    const saved = await this.locationRepository.save(entity);
    return this.toDomain(saved);
  }

  async update(location: Location): Promise<Location> {
    const existing = await this.locationRepository.findOneOrFail({
      where: { id: location.id },
    });
    existing.code = location.code;
    existing.name = location.name;
    existing.parentId = location.parentId;
    existing.isActive = location.isActive;
    const saved = await this.locationRepository.save(existing);
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.locationRepository.findOne({ where: { id } });
    if (existing) {
      await this.locationRepository.softRemove(existing);
    }
  }
}