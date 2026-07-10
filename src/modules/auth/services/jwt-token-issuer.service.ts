import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  TokenIssuerPort,
  TokenPair,
  TokenPayload,
} from './token-issuer.port';

@Injectable()
export class JwtTokenIssuerService implements TokenIssuerPort {
  private readonly accessTokenExpiresIn = 15 * 60;
  private readonly refreshTokenExpiresIn = 7 * 24 * 60 * 60;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issuePair(payload: TokenPayload, loginTimeoutMinutes?: number): Promise<TokenPair> {
    const accessExpiresIn = loginTimeoutMinutes ? loginTimeoutMinutes * 60 : this.accessTokenExpiresIn;

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'admin-access-secret'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'admin-refresh-secret'),
      expiresIn: this.refreshTokenExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: accessExpiresIn,
      refreshTokenExpiresIn: this.refreshTokenExpiresIn,
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
