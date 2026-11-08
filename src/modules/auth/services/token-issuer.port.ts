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
  // Profile claims so the console can show a real name straight from the
  // token (before /auth/me round-trips) and fall back to the username.
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
}

export interface TokenIssuerPort {
  issuePair(
    payload: TokenPayload,
    options?: {
      loginTimeoutMinutes?: number;
      roleExpirySeconds?: number;
    },
  ): Promise<TokenPair>;
  verifyRefreshToken(token: string): Promise<TokenPayload>;
}
