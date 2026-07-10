export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

export interface TokenPayload {
  sub: string;
  organizationId: string;
  locationId: string | null;
  username: string;
  roles: string[];
  permissions: string[];
  phone?: string;
  email: string;
}

export interface TokenIssuerPort {
  issuePair(payload: TokenPayload, loginTimeoutMinutes?: number): Promise<TokenPair>;
  verifyRefreshToken(token: string): Promise<TokenPayload>;
}
