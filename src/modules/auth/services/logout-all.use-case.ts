import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { TokenIssuerPort } from './token-issuer.port';
import { REFRESH_TOKEN_REPOSITORY, TOKEN_ISSUER } from './identity.di-tokens';

@Injectable()
export class LogoutAllUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuerPort,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(authHeader: string | undefined, refreshToken?: string): Promise<void> {
    let userId: string | null = null;

    // Prefer a still-valid access token; fall back to a refresh token so
    // "log out everywhere" still works once the access token has expired.
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      try {
        const verified = await this.jwtService.verifyAsync<{ sub: string }>(token, {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'admin-access-secret'),
        });
        userId = verified.sub;
      } catch {
        userId = null;
      }
    }

    if (!userId && refreshToken) {
      try {
        const decoded = await this.tokenIssuer.verifyRefreshToken(refreshToken);
        userId = decoded.sub;
      } catch {
        userId = null;
      }
    }

    if (!userId) {
      throw new UnauthorizedException('Unable to identify user session');
    }

    await this.refreshTokenRepository.revokeAllForUser(userId);
  }
}