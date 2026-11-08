import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import {
  TokenIssuerPort,
  TokenPair,
  TokenPayload,
} from './token-issuer.port';

@Injectable()
export class JwtTokenIssuerService implements TokenIssuerPort {
  private readonly defaultAccessTokenExpiresIn: number;
  private readonly maxAccessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn = 7 * 24 * 60 * 60;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.defaultAccessTokenExpiresIn = this.toMinutes('ACCESS_TOKEN_TTL_MINUTES', 15);
    this.maxAccessTokenExpiresIn = this.toMinutes('ACCESS_TOKEN_TTL_MAX_MINUTES', 1440);
  }

  private toMinutes(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key, String(fallback)));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  async issuePair(
    payload: TokenPayload,
    options?: {
      loginTimeoutMinutes?: number;
      roleExpirySeconds?: number;
    },
  ): Promise<TokenPair> {
    const maxAccessSeconds = this.maxAccessTokenExpiresIn * 60;
    const defaultAccessSeconds = this.defaultAccessTokenExpiresIn * 60;

    // Access token: role expiry > user login timeout > global default
    const accessEffectiveSeconds =
      options?.roleExpirySeconds ??
      (options?.loginTimeoutMinutes ? options.loginTimeoutMinutes * 60 : defaultAccessSeconds);
    const accessExpiresIn = Math.min(Math.max(1, Math.floor(accessEffectiveSeconds)), maxAccessSeconds);

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'admin-access-secret'),
      expiresIn: accessExpiresIn,
    });

    // Refresh token: role expiry > global refresh expiry (7 days)
    const refreshExpiresIn = Math.min(
      Math.max(1, options?.roleExpirySeconds ?? this.refreshTokenExpiresIn),
      this.refreshTokenExpiresIn,
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'admin-refresh-secret'),
        expiresIn: refreshExpiresIn,
      },
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: accessExpiresIn,
      refreshTokenExpiresIn: refreshExpiresIn,
    };
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'admin-refresh-secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
