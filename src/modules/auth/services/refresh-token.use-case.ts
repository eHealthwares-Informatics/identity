import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { UserRepository } from '../../users/repositories/user.repository';
import { UserLoginEventOrmEntity } from '../entities/user-login-event.orm-entity';
import {
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from './identity.di-tokens';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuerPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @InjectRepository(UserLoginEventOrmEntity)
    private readonly loginEventRepo: Repository<UserLoginEventOrmEntity>,
  ) {}

  async execute(payload: RefreshTokenDto): Promise<Awaited<ReturnType<TokenIssuerPort['issuePair']>>> {
    const decoded = await this.tokenIssuer.verifyRefreshToken(payload.refreshToken);

    const user = await this.userRepository.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = await this.passwordHasher.hash(payload.refreshToken);
    const isValid = await this.refreshTokenRepository.isValid(user.id, tokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepository.revoke(user.id, tokenHash);

    const tokenPair = await this.tokenIssuer.issuePair(
      {
        sub: decoded.sub,
        organizationId: user.organizationId ?? '',
        locationId: user.locationId,
        username: decoded.username,
        roles: decoded.roles,
        email: decoded.email,
        permissions: decoded.permissions,
      },
      user.loginTimeoutMinutes ?? undefined,
    );

    const newTokenHash = await this.passwordHasher.hash(tokenPair.refreshToken);
    await this.refreshTokenRepository.persist(
      user.id,
      newTokenHash,
      new Date(Date.now() + tokenPair.refreshTokenExpiresIn * 1000),
    );

    await this.loginEventRepo.save({
      userId: user.id,
      eventType: 'refresh',
      organizationId: user.organizationId ?? null,
    });

    return tokenPair;
  }
}
