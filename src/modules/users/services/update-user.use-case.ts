import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto';
import type { UserRepository } from '../repositories/user.repository';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { RefreshTokenRepository } from '../../auth/repositories/refresh-token.repository';
import { User } from '../domains/user.entity';
import {
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  ROLE_REPOSITORY,
  USER_REPOSITORY,
} from '../../auth/services/identity.di-tokens';

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
  ) {}

  async execute(userId: string, payload: UpdateUserDto, organizationId: string | null): Promise<User> {
    const user = await this.userRepository.findById(userId, organizationId ?? undefined);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleCodes = payload.roleCodes ?? user.roleCodes;
    let roles = user.roles;
    if (payload.roleCodes && organizationId) {
      roles = await this.roleRepository.listByCodes(roleCodes, organizationId);
      if (roles.length !== roleCodes.length) {
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
    );

    const saved = await this.userRepository.update(updatedUser, organizationId ?? undefined);

    // Changing the password must invalidate every existing session so the old
    // credentials can no longer be used (force re-login on all devices).
    if (passwordChanged) {
      await this.refreshTokenRepository.revokeAllForUser(userId);
    }

    return saved;
  }
}
