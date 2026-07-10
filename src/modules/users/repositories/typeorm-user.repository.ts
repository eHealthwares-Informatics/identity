import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserRepository } from './user.repository';
import { User } from '../domains/user.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { IdentityMapper } from '../../auth/mappers/identity.mapper';

@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
  ) {}

  async findByUsername(username: string, organizationId?: string | null): Promise<User | null> {
    const where: any = { username };
    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }
    const item = await this.userRepository.findOne({ where, relations: { roles: true } });
    return item ? IdentityMapper.toDomainUser(item) : null;
  }

  async findById(id: string, organizationId?: string | null): Promise<User | null> {
    const where: any = { id };
    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }
    const item = await this.userRepository.findOne({ where, relations: { roles: true } });
    return item ? IdentityMapper.toDomainUser(item) : null;
  }

  async create(user: User): Promise<User> {
    const entity = this.userRepository.create({
      id: user.id,
      organizationId: user.organizationId,
      locationId: user.locationId,
      username: user.username,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      phone: user.phone,
      email: user.email,
      roles: user.roles,
    });

    const saved = await this.userRepository.save(entity);
    const reloaded = await this.userRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { roles: true },
    });
    return IdentityMapper.toDomainUser(reloaded);
  }

  async update(user: User, organizationId?: string | null): Promise<User> {
    const where: any = { id: user.id };
    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }
    const existing = await this.userRepository.findOneOrFail({ where, relations: { roles: true } });

    existing.locationId = user.locationId;
    existing.passwordHash = user.passwordHash;
    existing.isActive = user.isActive;
    existing.phone = user.phone;
    existing.email = user.email;

    const saved = await this.userRepository.save(existing);
    const reloaded = await this.userRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { roles: true },
    });
    return IdentityMapper.toDomainUser(reloaded);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const existing = await this.userRepository.findOne({ where: { id, organizationId } });
    if (existing) {
      await this.userRepository.remove(existing);
    }
  }

  async list(offset: number, limit: number, organizationId: string): Promise<{ items: User[]; total: number }> {
    const [items, total] = await this.userRepository.findAndCount({
      relations: { roles: true },
      where: { organizationId, isActive: true },
      skip: offset,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: items.map(IdentityMapper.toDomainUser.bind(IdentityMapper)),
      total,
    };
  }
}
