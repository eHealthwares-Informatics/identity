import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compressPermissions } from '../../../common/utils/permission-set';
import { normalizeTenantId } from '../../../common/tenant-context';
import { LoginDto } from '../dto/login.dto';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { OrganizationRepository } from '../../organizations/repositories/organization.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { RefreshTokenRepository } from '../../auth/repositories/refresh-token.repository';
import { UserLoginEventOrmEntity } from '../entities/user-login-event.orm-entity';
import { LoginSessionService } from './login-session.service';
import {
  ORG_REPOSITORY,
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  ROLE_REPOSITORY,
  TOKEN_HASHER,
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
    /**
     * Fast digest used to *look up* refresh tokens (see the refresh/logout use
     * cases). `PASSWORD_HASHER` is a salted KDF, so hashing a refresh token
     * with it produces a digest that can never match a later lookup.
     */
    @Inject(TOKEN_HASHER)
    private readonly tokenHasher: PasswordHasherPort,
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
    @InjectRepository(UserLoginEventOrmEntity)
    private readonly loginEventRepo: Repository<UserLoginEventOrmEntity>,
    private readonly loginSessionService: LoginSessionService,
  ) {
    this.logger = new Logger(LoginUseCase.name);
  }

  private readonly logger: Logger;

  async execute(
    payload: LoginDto,
    organizationHeader?: string,
  ): Promise<
    Awaited<ReturnType<TokenIssuerPort['issuePair']>> & { sessionId?: string }
  > {
    const identifier = payload.username.trim();

    // Resolve the tenant scope. Usernames are only unique per organisation
    // (`uq_users_org_username`), so an unscoped lookup is ambiguous across
    // tenants. The explicit DTO field wins over the header.
    let organizationId =
      normalizeTenantId(payload.organizationId) ?? normalizeTenantId(organizationHeader);
    if (payload.organizationCode) {
      const organization = await this.organizationRepository.findByCode(
        payload.organizationCode.trim(),
      );
      if (!organization) {
        this.logger.warn(`Login failed: unknown organisation code=${payload.organizationCode}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      organizationId = organization.id;
    }

    this.logger.log(
      `Login attempt: identifier=${identifier} org=${organizationId ?? 'global'}`,
    );
    const user = identifier.includes('@')
      ? await this.userRepository.findByEmail(identifier.toLowerCase(), organizationId)
      : await this.userRepository.findByUsername(identifier, organizationId);

    // Phone-number fallback: shoppers sign in with the phone they registered
    // with (or received an OTP on). Password must still match.
    const resolved =
      user ?? (await this.userRepository.findByPhone(identifier, organizationId));
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
    // Max role-level JWT expiry (seconds) wins over user-level timeout.
    let roleExpirySeconds: number | undefined = undefined;
    for (const role of roles) {
      const exp = role.jwtExpirySeconds;
      if (exp !== null && exp > 0 && (roleExpirySeconds === undefined || exp > roleExpirySeconds)) {
        roleExpirySeconds = exp;
      }
    }
    const effectiveLoginTimeoutMinutes = roleExpirySeconds
      ? Math.ceil(roleExpirySeconds / 60)
      : resolved.loginTimeoutMinutes ?? undefined;
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
        firstName: resolved.profile.firstName ?? null,
        lastName: resolved.profile.lastName ?? null,
        displayName: resolved.profile.displayName ?? null,
        dateOfBirth: resolved.profile.dateOfBirth ?? null,
        gender: resolved.profile.gender ?? null,
      },
      {
        loginTimeoutMinutes: effectiveLoginTimeoutMinutes,
      },
    );

    // Token digests are looked up by value on refresh/logout, so they must use
    // the same deterministic hash the lookups use (TOKEN_HASHER / SHA-256).
    const refreshTokenHash = await this.tokenHasher.hash(tokenPair.refreshToken);
    const refreshTokenExpiresAt = new Date(
      Date.now() + tokenPair.refreshTokenExpiresIn * 1000,
    );
    await this.refreshTokenRepository.persist(
      resolved.id,
      refreshTokenHash,
      refreshTokenExpiresAt,
    );

    // Audit: one row per login (time, ip, user-agent, method, expiry). The
    // service swallows failures — a missing audit row must never fail a login.
    const sessionId = await this.loginSessionService.start({
      userId: resolved.id,
      username: resolved.username,
      organizationId: resolved.organizationId ?? null,
      channel: 'console',
      loginMethod: 'password',
      refreshTokenJti: tokenPair.refreshTokenJti,
      expiresAt: refreshTokenExpiresAt,
    });

    await this.loginEventRepo.save({
      userId: resolved.id,
      eventType: 'login',
      organizationId: resolved.organizationId ?? null,
    });

    this.logger.log(
      `Login succeeded: userId=${resolved.id} username=${resolved.username} org=${resolved.organizationId ?? null}`,
    );

    return { ...tokenPair, ...(sessionId ? { sessionId } : {}) };
  }
}
