import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { UserRepository } from '../repositories/user.repository';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string, organizationId: string): Promise<void> {
    const user = await this.userRepository.findById(userId, organizationId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.delete(userId, organizationId);
  }
}
