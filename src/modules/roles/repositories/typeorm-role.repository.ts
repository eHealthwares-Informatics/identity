import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { RoleRepository } from './role.repository';
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

  async findLastCreated(organizationId: string): Promise<Pick<Role, 'code'> | null> {
    const role = await this.roleRepository.findOne({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      select: ['code'],
    });
    return role ? { code: role.code } : null;
  }

  async findByCode(code: string, organizationId: string): Promise<Role | null> {
    const item = await this.roleRepository.findOne({
      where: { code, organizationId },
      relations: { permissions: true },
    });
    return item ? IdentityMapper.toDomainRole(item) : null;
  }

  async findById(id: string, organizationId: string): Promise<Role | null> {
    const item = await this.roleRepository.findOne({
      where: { id, organizationId },
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
      where: { organizationId },
      relations: { permissions: true },
      order: { code: 'ASC' },
    });
    return items.map(IdentityMapper.toDomainRole.bind(IdentityMapper));
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
    const orm = await this.roleRepository.findOne({ where: { id, organizationId } });
    if (!orm) throw new NotFoundException('Role not found');
    await this.roleRepository.remove(orm);
  }
}
