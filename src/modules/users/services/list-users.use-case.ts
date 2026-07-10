import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../repositories/user.repository';
import { USER_REPOSITORY } from '../../auth/services/identity.di-tokens';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(offset: number, limit: number, organizationId: string) {
    return this.userRepository.list(offset, limit, organizationId);
  }
}
