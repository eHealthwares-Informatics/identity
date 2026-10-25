import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateUserDto } from '../dto/create-user.dto';
import type { UserRepository } from '../repositories/user.repository';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { User } from '../domains/user.entity';
import type { Role } from '../../roles/domains/role.entity';
import { PASSWORD_HASHER, ROLE_REPOSITORY, USER_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {
    this.logger = new Logger(CreateUserUseCase.name);
  }

  private readonly logger: Logger;

  async execute(payload: CreateUserDto, organizationId: string | null): Promise<User> {
    this.logger.log(
      `Create user attempt: username=${payload.username} organizationId=${organizationId ?? null}`,
    );
    if (organizationId) {
      const existing = await this.userRepository.findByUsername(payload.username, organizationId);
      if (existing) {
        this.logger.warn(
          `Create user failed: username=${payload.username} already exists in org=${organizationId}`,
        );
        throw new BadRequestException('Username already exists');
      }
    }

    if (payload.email) {
      const emailOwner = await this.userRepository.findByEmail(payload.email.trim().toLowerCase());
      if (emailOwner) {
        this.logger.warn(
          `Create user failed: email=${payload.email} already in use`,
        );
        throw new BadRequestException('Email already in use');
      }
    }

    const roleCodes = payload.roleCodes ?? ['cashier'];
    let roles: Role[] = [];
    if (organizationId) {
      roles = await this.roleRepository.listByCodes(roleCodes, organizationId);
      if (roles.length !== roleCodes.length) {
        throw new BadRequestException('One or more roles are invalid');
      }
    }

    const passwordHash = await this.passwordHasher.hash(payload.password);
    const user = new User(
      randomUUID(),
      organizationId,
      payload.locationId ?? null,
      payload.username,
      passwordHash,
      true,
      roleCodes,
      roles,
      payload.phone,
      payload.email,
      payload.loginTimeoutMinutes ?? null,
    );

    const saved = await this.userRepository.create(user);
    this.logger.log(
      `User created: id=${saved?.id ?? '<pending>'} username=${payload.username} organizationId=${organizationId ?? null} roleCodes=[${roleCodes.join(', ')}]`,
    );
    return saved;
  }
}
