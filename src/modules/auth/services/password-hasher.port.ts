export interface PasswordHasherPort {
  hash(raw: string): Promise<string>;
  verify(raw: string, digest: string): Promise<boolean>;
  /**
   * True when `digest` is in a superseded format and should be replaced the next
   * time the plaintext is available (i.e. on a successful login). Callers use
   * this to upgrade existing accounts without forcing a password reset.
   */
  needsRehash(digest: string): boolean;
}
