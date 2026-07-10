import type { UserRepository } from '../repositories/user.repository';
export declare class DeleteUserUseCase {
    private readonly userRepository;
    constructor(userRepository: UserRepository);
    execute(userId: string, organizationId: string): Promise<void>;
}
