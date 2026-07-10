import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RegisterDto } from '../dto/register.dto';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import { User } from '../../users/domains/user.entity';
import { PASSWORD_HASHER, ROLE_REPOSITORY, USER_REPOSITORY } from './identity.di-tokens';
import { LoginUseCase } from './login.use-case';

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  async execute(payload: RegisterDto): Promise<any> {
    const existing = await this.userRepository.findByUsername(payload.username);
    if (existing) {
      throw new BadRequestException('Username already exists');
    }

    const defaultOrgId = 'df3b4afd-9955-4617-9a82-264cc73dd8b2';
    const roleCodes = ['website_user'];
    const roles = await this.roleRepository.listByCodes(roleCodes, defaultOrgId);
    if (roles.length !== roleCodes.length) {
      throw new BadRequestException('Website user role not configured');
    }

    const passwordHash = await this.passwordHasher.hash(payload.password);
    const user = new User(
      randomUUID(),
      defaultOrgId,
      null,
      payload.username,
      passwordHash,
      true,
      roleCodes,
      roles,
      payload.phone,
      payload.email,
    );

    await this.userRepository.create(user);

    return this.loginUseCase.execute({ username: payload.username, password: payload.password });
  }
}
