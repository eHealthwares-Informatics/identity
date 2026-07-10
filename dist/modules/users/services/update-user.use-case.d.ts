import { UpdateUserDto } from '../dto/update-user.dto';
import type { UserRepository } from '../repositories/user.repository';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { User } from '../domains/user.entity';
export declare class UpdateUserUseCase {
    private readonly userRepository;
    private readonly passwordHasher;
    private readonly roleRepository;
    constructor(userRepository: UserRepository, passwordHasher: PasswordHasherPort, roleRepository: RoleRepository);
    execute(userId: string, payload: UpdateUserDto, organizationId: string | null): Promise<User>;
}
