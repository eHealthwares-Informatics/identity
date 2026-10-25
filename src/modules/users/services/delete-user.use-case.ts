import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { UserRepository } from '../repositories/user.repository';

@Injectable()
export class DeleteUserUseCase {
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string, organizationId: string): Promise<void> {
    this.logger.log(`Delete user attempt: id=${userId} organizationId=${organizationId}`);
    const user = await this.userRepository.findById(userId, organizationId);
    if (!user) {
      this.logger.warn(`User not found: id=${userId} organizationId=${organizationId}`);
      throw new NotFoundException('User not found');
    }
    await this.userRepository.delete(userId, organizationId);
    this.logger.log(`User deleted: id=${userId} organizationId=${organizationId}`);
  }
}
