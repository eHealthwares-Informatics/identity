import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AssignRoleDto } from '../dto/assign-role.dto';
import type { UserRepository } from '../repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { ROLE_REPOSITORY, USER_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class AssignRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(userId: string, payload: AssignRoleDto, organizationId: string) {
    const user = await this.userRepository.findById(userId, organizationId);
    if (!user) throw new NotFoundException('User not found');

    const role = await this.roleRepository.findByCode(payload.roleCode, organizationId);
    if (!role) throw new BadRequestException('Role not found');

    if (!user.roleCodes.includes(payload.roleCode)) {
      user.roleCodes.push(payload.roleCode);
      await this.userRepository.update(user, organizationId);
    }

    return user;
  }
}
