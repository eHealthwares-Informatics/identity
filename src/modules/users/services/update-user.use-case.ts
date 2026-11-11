import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';
import type { UserRepository } from '../repositories/user.repository';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { RefreshTokenRepository } from '../../auth/repositories/refresh-token.repository';
import { User, type UserProfile } from '../domains/user.entity';
import {
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  ROLE_REPOSITORY,
  USER_REPOSITORY,
} from '../../auth/services/identity.di-tokens';

/** Blank/whitespace-only profile input clears the value back to null. */
function cleanProfileValue(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Profile fields follow the same tri-state rule as the rest of the payload:
 * undefined leaves the stored value untouched, null (or blank) clears it.
 */
function mergeProfile(current: UserProfile, payload: UpdateUserDto): UserProfile {
  const profile: UserProfile = { ...current };
  if (payload.firstName !== undefined) {
    profile.firstName = cleanProfileValue(payload.firstName);
  }
  if (payload.lastName !== undefined) {
    profile.lastName = cleanProfileValue(payload.lastName);
  }
  if (payload.dateOfBirth !== undefined) {
    profile.dateOfBirth = cleanProfileValue(payload.dateOfBirth);
  }
  if (payload.gender !== undefined) {
    profile.gender = cleanProfileValue(payload.gender);
  }
  return profile;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {
    this.logger = new Logger(UpdateUserUseCase.name);
  }

  private readonly logger: Logger;

  async execute(userId: string, payload: UpdateUserDto, organizationId: string | null): Promise<User> {
    // A super-admin token carries organizationId '' (global). Blank means "no
    // organisation scope" — normalise it so it never reaches a uuid filter, and
    // so role resolution falls back to the target user's own organisation.
    const scopedOrganizationId = organizationId?.trim() || null;
    this.logger.log(
      `Update user attempt: id=${userId} organizationId=${scopedOrganizationId ?? null}`,
    );
    const user = await this.userRepository.findById(userId, scopedOrganizationId ?? undefined);
    if (!user) {
      this.logger.warn(`User not found: id=${userId} organizationId=${organizationId ?? null}`);
      throw new NotFoundException('User not found');
    }

    const roleCodes = payload.roleCodes ?? user.roleCodes;
    let roles = user.roles;
    // Resolve roles against the TARGET user's organization. The actor may be a
    // global super_admin (organizationId null); falling back to the user's own
    // org keeps role edits working instead of silently leaving stale roles
    // (which would strip the user's permissions/modules on next login).
    const roleScopeOrg = scopedOrganizationId ?? user.organizationId;
    if (payload.roleCodes) {
      if (!roleScopeOrg) {
        this.logger.warn(
          `Update user failed: cannot resolve roles for org-less user id=${userId}`,
        );
        throw new BadRequestException('User has no organization to resolve roles against');
      }
      roles = await this.roleRepository.listByCodes(roleCodes, roleScopeOrg);
      if (roles.length !== roleCodes.length) {
        this.logger.warn(
          `Update user failed: id=${userId} one or more roles are invalid in org=${roleScopeOrg}`,
        );
        throw new BadRequestException('One or more roles are invalid');
      }
    }

    const passwordChanged = Boolean(payload.password);
    const passwordHash = passwordChanged
      ? await this.passwordHasher.hash(payload.password!)
      : user.passwordHash;

    // undefined = leave unchanged; null = explicitly clear back to system default
    const loginTimeoutMinutes =
      payload.loginTimeoutMinutes === undefined
        ? user.loginTimeoutMinutes
        : payload.loginTimeoutMinutes;

    const updatedUser = new User(
      userId,
      user.organizationId,
      payload.locationId ?? user.locationId,
      payload.username ?? user.username,
      passwordHash,
      payload.isActive ?? user.isActive,
      roleCodes,
      roles,
      payload.phone ?? user.phone,
      payload.email ?? user.email,
      loginTimeoutMinutes,
      mergeProfile(user.profile, payload),
    );

    const saved = await this.userRepository.update(updatedUser, scopedOrganizationId ?? undefined);

    // Changing the password must invalidate every existing session so the old
    // credentials can no longer be used (force re-login on all devices).
    if (passwordChanged) {
      await this.refreshTokenRepository.revokeAllForUser(userId);
      this.logger.log(`User password changed: id=${userId} all sessions revoked`);
    }

    this.logger.log(`User updated: id=${saved.id} organizationId=${organizationId ?? null}`);
    return saved;
  }
}
