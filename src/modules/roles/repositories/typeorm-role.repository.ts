import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import { RoleListQuery, RoleRepository } from './role.repository';
import { Role } from '../domains/role.entity';
import { RoleOrmEntity } from '../entities/role.orm-entity';
import { PermissionOrmEntity } from '../entities/permission.orm-entity';
import { IdentityMapper } from '../../auth/mappers/identity.mapper';

@Injectable()
export class TypeormRoleRepository implements RoleRepository {
  constructor(
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepository: Repository<RoleOrmEntity>,
    @InjectRepository(PermissionOrmEntity)
    private readonly permissionRepository: Repository<PermissionOrmEntity>,
  ) {}

  /**
   * A super-admin / system token carries `organizationId: ''`. Blank means
   * "global — no organisation scope" and must never be bound as a uuid filter
   * (`invalid input syntax for type uuid: ""`).
   */
  private scopedOrganizationId(organizationId?: string | null): string | undefined {
    const value = typeof organizationId === 'string' ? organizationId.trim() : '';
    return value ? value : undefined;
  }

  async findLastCreated(organizationId: string): Promise<Pick<Role, 'code'> | null> {
    const where: any = {};
    const org = this.scopedOrganizationId(organizationId);
    if (org) where.organizationId = org;
    const role = await this.roleRepository.findOne({
      where,
      order: { createdAt: 'DESC' },
      select: ['code'],
    });
    return role ? { code: role.code } : null;
  }

  async findByCode(code: string, organizationId: string): Promise<Role | null> {
    const where: any = { code };
    const org = this.scopedOrganizationId(organizationId);
    if (org) where.organizationId = org;
    const item = await this.roleRepository.findOne({
      where,
      relations: { permissions: true },
    });
    return item ? IdentityMapper.toDomainRole(item) : null;
  }

  async findById(id: string, organizationId: string): Promise<Role | null> {
    const where: any = { id };
    const org = this.scopedOrganizationId(organizationId);
    if (org) where.organizationId = org;
    const item = await this.roleRepository.findOne({
      where,
      relations: { permissions: true },
    });
    return item ? IdentityMapper.toDomainRole(item) : null;
  }

  async listByCodes(codes: string[], organizationId: string): Promise<Role[]> {
    if (!codes.length) return [];
    const items = await this.roleRepository.find({
      where: codes.map((code) => ({ code, organizationId })),
      relations: { permissions: true },
    });
    return items.map(IdentityMapper.toDomainRole.bind(IdentityMapper));
  }

  async listAll(organizationId: string): Promise<Role[]> {
    const items = await this.roleRepository.find({
      where: { organizationId: organizationId ? organizationId : Not(IsNull()) },
      relations: { permissions: true },
      order: { code: 'ASC' },
    });
    return items.map(IdentityMapper.toDomainRole.bind(IdentityMapper));
  }

  async list(query: RoleListQuery): Promise<{ items: Role[]; total: number }> {
    const qb = this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission')
      
      if (query.organizationId) {
        qb.where('role.organizationId = :organizationId', {
        organizationId: query.organizationId,
      });
      }

    if (query.search) {
      qb.andWhere(
        new Brackets((where) => {
          where.orWhere('role.code ILIKE :search', { search: `%${query.search}%` });
          where.orWhere('role.name ILIKE :search', { search: `%${query.search}%` });
          where.orWhere('role.description ILIKE :search', { search: `%${query.search}%` });
        }),
      );
    }

    const [items, total] = await qb
      .orderBy('role.code', 'ASC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: items.map(IdentityMapper.toDomainRole.bind(IdentityMapper)),
      total,
    };
  }

  async create(role: Role): Promise<Role> {
    const permissions = role.permissionCodes.length
      ? await this.permissionRepository.findBy({ code: In(role.permissionCodes) })
      : [];

    const orm = this.roleRepository.create({
      id: role.id,
      organizationId: role.organizationId,
      code: role.code,
      name: role.name,
      description: role.description ?? null,
      permissions,
      jwtExpirySeconds: role.jwtExpirySeconds,
    });

    const saved = await this.roleRepository.save(orm);
    return IdentityMapper.toDomainRole(saved);
  }

  async update(role: Role): Promise<Role> {
    const orm = await this.roleRepository.findOne({
      where: { id: role.id },
      relations: { permissions: true },
    });
    if (!orm) throw new NotFoundException('Role not found');

    orm.code = role.code;
    orm.name = role.name;
    orm.description = role.description ?? null;
    orm.jwtExpirySeconds = role.jwtExpirySeconds;

    if (role.permissionCodes) {
      const permissions = role.permissionCodes.length
        ? await this.permissionRepository.findBy({ code: In(role.permissionCodes) })
        : [];
      orm.permissions = permissions;
    }

    const saved = await this.roleRepository.save(orm);
    return IdentityMapper.toDomainRole(saved);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const where: any = { id };
    const org = this.scopedOrganizationId(organizationId);
    if (org) where.organizationId = org;
    const orm = await this.roleRepository.findOne({ where });
    if (!orm) throw new NotFoundException('Role not found');
    await this.roleRepository.remove(orm);
  }
}
