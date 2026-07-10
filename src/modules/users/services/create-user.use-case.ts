import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateUserDto } from '../dto/create-user.dto';
import type { UserRepository } from '../repositories/user.repository';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { User } from '../domains/user.entity';
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
  ) {}

  async execute(payload: CreateUserDto, organizationId: string | null): Promise<User> {
    if (organizationId) {
      const existing = await this.userRepository.findByUsername(payload.username, organizationId);
      if (existing) {
        throw new BadRequestException('Username already exists');
      }
    }

    const roleCodes = payload.roleCodes ?? ['cashier'];
    if (organizationId) {
      const roles = await this.roleRepository.listByCodes(roleCodes, organizationId);
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
      [],
      payload.phone,
      payload.email,
    );

    return this.userRepository.create(user);
  }
}
