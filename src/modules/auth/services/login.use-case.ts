import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compressPermissions } from '../../../common/utils/permission-set';
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
  ) {
    this.logger = new Logger(LoginUseCase.name);
  }

  private readonly logger: Logger;

  async execute(payload: LoginDto): Promise<Awaited<ReturnType<TokenIssuerPort['issuePair']>>> {
    const identifier = payload.username.trim();
    this.logger.log(`Login attempt: identifier=${identifier}`);
    const user = identifier.includes('@')
      ? await this.userRepository.findByEmail(identifier.toLowerCase())
      : await this.userRepository.findByUsername(identifier);

    // Phone-number fallback: shoppers sign in with the phone they registered
    // with (or received an OTP on). Password must still match.
    const resolved = user ?? (await this.userRepository.findByPhone(identifier));
    if (!resolved || !resolved.isActive) {
      this.logger.warn(`Login failed: user not found or inactive (identifier=${identifier})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.passwordHasher.verify(payload.password, resolved.passwordHash);
    if (!isValid) {
      this.logger.warn(`Login failed: invalid password (userId=${resolved.id})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Upgrade a superseded digest (unsalted SHA-256) now that we hold the
    // plaintext — this is the only moment it is available, so it is how existing
    // accounts migrate without a forced reset (rxsoft-qa#142). Best-effort: a
    // failed upgrade must never fail the login itself.
    if (this.passwordHasher.needsRehash(resolved.passwordHash)) {
      try {
        resolved.passwordHash = await this.passwordHasher.hash(payload.password);
        await this.userRepository.update(resolved);
      } catch {
        // Ignore — the account still signs in and upgrades on a later login.
      }
    }

    const roles = resolved.organizationId
      ? await this.roleRepository.listByCodes(resolved.roleCodes, resolved.organizationId)
      : [];
    // Minimal set: a parent grant covers its subtree, so children it already
    // covers are dropped rather than shipped in the token and /auth/me.
    const permissions = compressPermissions(roles.flatMap((role) => role.permissionCodes));

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

    this.logger.log(
      `Login succeeded: userId=${resolved.id} username=${resolved.username} org=${resolved.organizationId ?? null}`,
    );

    return tokenPair;
  }
}
