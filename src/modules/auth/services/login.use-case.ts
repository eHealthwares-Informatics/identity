import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginDto } from '../dto/login.dto';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { RefreshTokenRepository } from '../../auth/repositories/refresh-token.repository';
import { UserLoginEventOrmEntity } from '../entities/user-login-event.orm-entity';
import {
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  ROLE_REPOSITORY,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from './identity.di-tokens';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuerPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @InjectRepository(UserLoginEventOrmEntity)
    private readonly loginEventRepo: Repository<UserLoginEventOrmEntity>,
  ) {}

  async execute(payload: LoginDto): Promise<Awaited<ReturnType<TokenIssuerPort['issuePair']>>> {
    const identifier = payload.username.trim();
    const user = identifier.includes('@')
      ? await this.userRepository.findByEmail(identifier.toLowerCase())
      : await this.userRepository.findByUsername(identifier);

    // Phone-number fallback: shoppers sign in with the phone they registered
    // with (or received an OTP on). Password must still match.
    const resolved = user ?? (await this.userRepository.findByPhone(identifier));
    if (!resolved || !resolved.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.passwordHasher.verify(payload.password, resolved.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = resolved.organizationId
      ? await this.roleRepository.listByCodes(resolved.roleCodes, resolved.organizationId)
      : [];
    const permissions = [...new Set(roles.flatMap((role) => role.permissionCodes))];

    const tokenPair = await this.tokenIssuer.issuePair(
      {
        sub: resolved.id,
        organizationId: resolved.organizationId ?? '',
        locationId: resolved.locationId,
        username: resolved.username,
        roles: resolved.roleCodes,
        permissions,
        phone: resolved.phone,
        email: resolved.email ?? resolved.id,
      },
      resolved.loginTimeoutMinutes ?? undefined,
    );

    const refreshTokenHash = await this.passwordHasher.hash(tokenPair.refreshToken);
    await this.refreshTokenRepository.persist(
      resolved.id,
      refreshTokenHash,
      new Date(Date.now() + tokenPair.refreshTokenExpiresIn * 1000),
    );

    await this.loginEventRepo.save({
      userId: resolved.id,
      eventType: 'login',
      organizationId: resolved.organizationId ?? null,
    });

    return tokenPair;
  }
}
