import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PasswordHasherPort } from './password-hasher.port';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const ALGORITHM = 'scrypt';
const SALT_BYTES = 16;
const KEY_LENGTH = 64;
/** The superseded format: an unsalted SHA-256 hex digest. */
const LEGACY_SHA256 = /^[0-9a-f]{64}$/i;

/**
 * Password hashing — a real KDF instead of a bare digest (rxsoft-qa#142).
 *
 * The previous scheme was `sha256(password)`: no salt, no work factor, so it
 * was trivially rainbow-tabled and cheap to brute force. `node:crypto`'s scrypt
 * gives a salted, deliberately-expensive KDF without adding a native dependency
 * (bcrypt/argon2 would both need one). Format:
 *
 *   scrypt$<salt hex>$<derived key hex>
 *
 * Legacy digests still **verify** — existing accounts keep working — and
 * `needsRehash` tells the caller to upgrade them on the next successful login.
 */
@Injectable()
export class ScryptPasswordHasherService implements PasswordHasherPort {
  async hash(raw: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const derived = await scrypt(raw, salt, KEY_LENGTH);
    return `${ALGORITHM}$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  async verify(raw: string, digest: string): Promise<boolean> {
    if (this.isLegacy(digest)) {
      return this.verifyLegacy(raw, digest);
    }

    const [algorithm, saltHex, keyHex] = digest.split('$');
    if (algorithm !== ALGORITHM || !saltHex || !keyHex) {
      return false;
    }

    try {
      const derived = await scrypt(raw, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
      const expected = Buffer.from(keyHex, 'hex');
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    } catch {
      // A malformed salt/digest is a failed verification, not a 500.
      return false;
    }
  }

  needsRehash(digest: string): boolean {
    return this.isLegacy(digest);
  }

  private isLegacy(digest: string): boolean {
    return LEGACY_SHA256.test(digest);
  }

  /** Timing-safe comparison for the superseded unsalted digest. */
  private verifyLegacy(raw: string, digest: string): boolean {
    const hashed = createHash('sha256').update(raw).digest('hex');
    const a = Buffer.from(hashed);
    const b = Buffer.from(digest.toLowerCase());
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
