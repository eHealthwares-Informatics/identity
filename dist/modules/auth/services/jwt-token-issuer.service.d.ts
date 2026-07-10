import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenIssuerPort, TokenPair, TokenPayload } from './token-issuer.port';
export declare class JwtTokenIssuerService implements TokenIssuerPort {
    private readonly jwtService;
    private readonly configService;
    private readonly accessTokenExpiresIn;
    private readonly refreshTokenExpiresIn;
    constructor(jwtService: JwtService, configService: ConfigService);
    issuePair(payload: TokenPayload, loginTimeoutMinutes?: number): Promise<TokenPair>;
    verifyRefreshToken(token: string): Promise<TokenPayload>;
}
