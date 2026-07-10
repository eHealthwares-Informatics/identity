export interface RefreshTokenRepository {
  persist(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  isValid(userId: string, tokenHash: string): Promise<boolean>;
  revoke(userId: string, tokenHash: string): Promise<void>;
}
