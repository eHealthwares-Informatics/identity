import { Inject, Injectable } from '@nestjs/common';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort } from './token-issuer.port';
import { PASSWORD_HASHER, REFRESH_TOKEN_REPOSITORY, TOKEN_ISSUER } from './identity.di-tokens';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuerPort,
  ) {}

  async execute(payload: RefreshTokenDto): Promise<void> {
    let userId: string | undefined;
    try {
      const decoded = await this.tokenIssuer.verifyRefreshToken(payload.refreshToken);
      userId = decoded.sub;
    } catch {
      userId = undefined;
    }

    // Idempotent — an already-expired or already-revoked token is a no-op.
    if (!userId) return;

    const tokenHash = await this.passwordHasher.hash(payload.refreshToken);
    await this.refreshTokenRepository.revoke(userId, tokenHash);
  }
}