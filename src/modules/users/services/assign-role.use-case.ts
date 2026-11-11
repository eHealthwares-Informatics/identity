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
    const scopedOrganizationId = organizationId?.trim() || undefined;
    this.logger.log(
      `Assign role attempt: userId=${userId} role=${payload.roleCode} organizationId=${scopedOrganizationId ?? null}`,
    );
    const user = await this.userRepository.findById(userId, scopedOrganizationId);
    if (!user) {
      this.logger.warn(
        `User not found: id=${userId} organizationId=${scopedOrganizationId ?? null}`,
      );
      throw new NotFoundException('User not found');
    }

    // `roles.organization_id` is a non-null uuid, so a global admin (org '')
    // must resolve roles against the target user's organisation — never bind
    // '' to the uuid column.
    const roleScopeOrg = scopedOrganizationId ?? user.organizationId;
    if (!roleScopeOrg) {
      throw new BadRequestException('User has no organization to resolve roles against');
    }

    const role = await this.roleRepository.findByCode(payload.roleCode, roleScopeOrg);
    if (!role) {
      this.logger.warn(`Role not found: code=${payload.roleCode} organizationId=${roleScopeOrg}`);
      throw new BadRequestException('Role not found');
    }

    if (!user.roleCodes.includes(payload.roleCode)) {
      user.roleCodes.push(payload.roleCode);
      // The repository persists the resolved role entities (`user.roles`), not
      // the raw codes. Resolve them here or the assignment is silently dropped
      // and the user ends up with no permissions (and therefore no modules).
      user.roles = await this.roleRepository.listByCodes(user.roleCodes, roleScopeOrg);
      await this.userRepository.update(user, roleScopeOrg);
      this.logger.log(
        `Role assigned: userId=${userId} role=${payload.roleCode} organizationId=${roleScopeOrg}`,
      );
    } else {
      this.logger.log(
        `Role already assigned: userId=${userId} role=${payload.roleCode} organizationId=${roleScopeOrg}`,
      );
    }

    return user;
  }
}
