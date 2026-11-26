export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  /** `jti` of the refresh token — correlates it with the session audit row. */
  refreshTokenJti: string;
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
  /** Refresh-token id (only present on refresh tokens). */
  jti?: string;
}

/**
 * The lifetimes the issuer applies. Exposed so clients can explain a session
 * timeline ("auto refreshed at …", "auto logged out at …") without hardcoding
 * the same numbers — the effective access lifetime for a user is
 * `min(user.loginTimeoutMinutes ?? defaultAccessTokenMinutes, maxAccessTokenMinutes)`.
 */
export interface TokenPolicy {
  defaultAccessTokenMinutes: number;
  maxAccessTokenMinutes: number;
  refreshTokenMinutes: number;
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
  /** Effective token lifetimes (no secrets). */
  getPolicy(): TokenPolicy;
}
