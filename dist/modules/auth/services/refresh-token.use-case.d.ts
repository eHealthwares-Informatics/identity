import { RefreshTokenDto } from '../dto/refresh-token.dto';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import type { UserRepository } from '../../users/repositories/user.repository';
export declare class RefreshTokenUseCase {
    private readonly refreshTokenRepository;
    private readonly passwordHasher;
    private readonly tokenIssuer;
    private readonly userRepository;
    constructor(refreshTokenRepository: RefreshTokenRepository, passwordHasher: PasswordHasherPort, tokenIssuer: TokenIssuerPort, userRepository: UserRepository);
    execute(payload: RefreshTokenDto): Promise<Awaited<ReturnType<TokenIssuerPort['issuePair']>>>;
}
