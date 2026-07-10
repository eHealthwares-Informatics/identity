import { LoginDto } from '../dto/login.dto';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { RefreshTokenRepository } from '../../auth/repositories/refresh-token.repository';
export declare class LoginUseCase {
    private readonly userRepository;
    private readonly roleRepository;
    private readonly passwordHasher;
    private readonly tokenIssuer;
    private readonly refreshTokenRepository;
    constructor(userRepository: UserRepository, roleRepository: RoleRepository, passwordHasher: PasswordHasherPort, tokenIssuer: TokenIssuerPort, refreshTokenRepository: RefreshTokenRepository);
    execute(payload: LoginDto): Promise<Awaited<ReturnType<TokenIssuerPort['issuePair']>>>;
}
