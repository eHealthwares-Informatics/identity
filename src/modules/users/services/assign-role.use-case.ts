import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AssignRoleDto } from '../dto/assign-role.dto';
import type { UserRepository } from '../repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { ROLE_REPOSITORY, USER_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class AssignRoleUseCase {
  private readonly logger = new Logger(AssignRoleUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(userId: string, payload: AssignRoleDto, organizationId: string) {
    this.logger.log(
      `Assign role attempt: userId=${userId} role=${payload.roleCode} organizationId=${organizationId}`,
    );
    const user = await this.userRepository.findById(userId, organizationId);
    if (!user) {
      this.logger.warn(`User not found: id=${userId} organizationId=${organizationId}`);
      throw new NotFoundException('User not found');
    }

    const role = await this.roleRepository.findByCode(payload.roleCode, organizationId);
    if (!role) {
      this.logger.warn(`Role not found: code=${payload.roleCode} organizationId=${organizationId}`);
      throw new BadRequestException('Role not found');
    }

    if (!user.roleCodes.includes(payload.roleCode)) {
      user.roleCodes.push(payload.roleCode);
      await this.userRepository.update(user, organizationId);
      this.logger.log(
        `Role assigned: userId=${userId} role=${payload.roleCode} organizationId=${organizationId}`,
      );
    } else {
      this.logger.log(
        `Role already assigned: userId=${userId} role=${payload.roleCode} organizationId=${organizationId}`,
      );
    }

    return user;
  }
}
