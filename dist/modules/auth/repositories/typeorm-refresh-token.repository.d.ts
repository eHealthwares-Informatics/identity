import { Repository } from 'typeorm';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RefreshTokenOrmEntity } from '../entities/refresh-token.orm-entity';
import { UserOrmEntity } from '../../users/entities/user.orm-entity';
export declare class TypeormRefreshTokenRepository implements RefreshTokenRepository {
    private readonly refreshTokenRepository;
    private readonly userRepository;
    constructor(refreshTokenRepository: Repository<RefreshTokenOrmEntity>, userRepository: Repository<UserOrmEntity>);
    persist(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
    isValid(userId: string, tokenHash: string): Promise<boolean>;
    revoke(userId: string, tokenHash: string): Promise<void>;
}
