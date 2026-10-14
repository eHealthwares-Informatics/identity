import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PasswordHasherPort } from './password-hasher.port';

/**
 * Token hashing — NOT password hashing.
 *
 * Refresh tokens are high-entropy random strings, so a fast digest is the right
 * tool: there is nothing to brute force, and a KDF would only add latency to
 * every login and refresh. Passwords moved to `ScryptPasswordHasherService`
 * (rxsoft-qa#142); this stays for `PASSWORD_HASHER`'s former token callers via
 * the `TOKEN_HASHER` binding.
 */
@Injectable()
export class Sha256PasswordHasherService implements PasswordHasherPort {
  async hash(raw: string): Promise<string> {
    return createHash('sha256').update(raw).digest('hex');
  }

  async verify(raw: string, digest: string): Promise<boolean> {
    const hashed = await this.hash(raw);
    return hashed === digest;
  }

  /** Never true — token digests are not passwords and are never rehashed. */
  needsRehash(): boolean {
    return false;
  }
}
