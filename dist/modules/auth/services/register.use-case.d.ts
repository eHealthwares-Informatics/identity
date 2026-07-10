import { RegisterDto } from '../dto/register.dto';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import { LoginUseCase } from './login.use-case';
export declare class RegisterUseCase {
    private readonly userRepository;
    private readonly roleRepository;
    private readonly passwordHasher;
    private readonly loginUseCase;
    constructor(userRepository: UserRepository, roleRepository: RoleRepository, passwordHasher: PasswordHasherPort, loginUseCase: LoginUseCase);
    execute(payload: RegisterDto): Promise<any>;
}
