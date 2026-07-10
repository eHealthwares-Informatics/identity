import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RefreshTokenOrmEntity } from '../entities/refresh-token.orm-entity';
import { UserOrmEntity } from '../../users/entities/user.orm-entity';

@Injectable()
export class TypeormRefreshTokenRepository implements RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
  ) {}

  async persist(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const user = await this.userRepository.findOneByOrFail({ id: userId });

    const entity = this.refreshTokenRepository.create({
      user,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });

    await this.refreshTokenRepository.save(entity);
  }

  async isValid(userId: string, tokenHash: string): Promise<boolean> {
    const item = await this.refreshTokenRepository.findOne({
      where: {
        user: { id: userId },
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });

    return Boolean(item);
  }

  async revoke(userId: string, tokenHash: string): Promise<void> {
    await this.refreshTokenRepository.update(
      {
        user: { id: userId },
        tokenHash,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );
  }
}
