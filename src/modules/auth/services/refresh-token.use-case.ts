import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { UserLoginEventOrmEntity } from '../entities/user-login-event.orm-entity';
import { LoginSessionService } from './login-session.service';
import {
  TOKEN_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_ISSUER,
  USER_REPOSITORY,
  ROLE_REPOSITORY,
} from './identity.di-tokens';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(TOKEN_HASHER)
    private readonly tokenHasher: PasswordHasherPort,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuerPort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @InjectRepository(UserLoginEventOrmEntity)
    private readonly loginEventRepo: Repository<UserLoginEventOrmEntity>,
    private readonly loginSessionService: LoginSessionService,
  ) {}

  async execute(payload: RefreshTokenDto): Promise<Awaited<ReturnType<TokenIssuerPort['issuePair']>>> {
    const decoded = await this.tokenIssuer.verifyRefreshToken(payload.refreshToken);

    const user = await this.userRepository.findById(decoded.sub);
    if (!user || !user.isActive) {
      await this.loginSessionService.endByRefreshJti(
        decoded.sub,
        decoded.jti,
        'user_deactivated',
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = await this.tokenHasher.hash(payload.refreshToken);
    const isValid = await this.refreshTokenRepository.isValid(user.id, tokenHash);
    if (!isValid) {
      // The token verified but is no longer in the store: either it was already
      // rotated (replay) or revoked. Close the audited session accordingly.
      await this.loginSessionService.endByRefreshJti(
        user.id,
        decoded.jti,
        'refresh_reuse',
      );
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
        firstName: user.profile.firstName ?? null,
        lastName: user.profile.lastName ?? null,
        displayName: user.profile.displayName ?? null,
      },
      {
        loginTimeoutMinutes: user.loginTimeoutMinutes ?? undefined,
        roleExpirySeconds: await this.computeRoleExpirySeconds(decoded.roles, user.organizationId ?? null),
      },
    );

    const newTokenHash = await this.tokenHasher.hash(tokenPair.refreshToken);
    const newExpiresAt = new Date(Date.now() + tokenPair.refreshTokenExpiresIn * 1000);
    await this.refreshTokenRepository.persist(
      user.id,
      newTokenHash,
      newExpiresAt,
    );

    // Audit: same session row, new rotation instant / ip / jti.
    await this.loginSessionService.recordRefresh(user.id, decoded.jti, {
      refreshTokenJti: tokenPair.refreshTokenJti,
      expiresAt: newExpiresAt,
    });

    await this.loginEventRepo.save({
      userId: user.id,
      eventType: 'refresh',
      organizationId: user.organizationId ?? null,
    });

    return tokenPair;
  }

  private async computeRoleExpirySeconds(
    roleCodes: string[],
    organizationId: string | null,
  ): Promise<number | undefined> {
    if (!roleCodes.length || !organizationId) {
      return undefined;
    }
    const roles = await this.roleRepository.listByCodes(roleCodes, organizationId);
    const expiries = roles
      .map((r) => r.jwtExpirySeconds)
      .filter((s) => s != null && s > 0) as number[];
    return expiries.length > 0 ? Math.max(...expiries) : undefined;
  }
}
