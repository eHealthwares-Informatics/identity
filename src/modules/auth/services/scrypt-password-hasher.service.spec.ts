import { createHash } from 'node:crypto';
import { ScryptPasswordHasherService } from './scrypt-password-hasher.service';

/**
 * rxsoft-qa#142 — passwords were `sha256(password)`: no salt, no work factor.
 * Now a salted scrypt KDF, with the legacy digest still verifying so existing
 * accounts keep working until they next log in.
 */
describe('ScryptPasswordHasherService', () => {
  const hasher = new ScryptPasswordHasherService();

  it('produces a scrypt$salt$key digest (not a bare hash)', async () => {
    const digest = await hasher.hash('correct horse battery staple');
    const [algorithm, salt, key] = digest.split('$');

    expect(algorithm).toBe('scrypt');
    expect(salt).toMatch(/^[0-9a-f]{32}$/); // 16 random bytes
    expect(key).toMatch(/^[0-9a-f]{128}$/); // 64-byte derived key
  });

  it('salts — the same password hashes differently every time', async () => {
    const a = await hasher.hash('same-password');
    const b = await hasher.hash('same-password');

    expect(a).not.toBe(b);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const digest = await hasher.hash('s3cret');

    await expect(hasher.verify('s3cret', digest)).resolves.toBe(true);
    await expect(hasher.verify('s3cret ', digest)).resolves.toBe(false);
    await expect(hasher.verify('', digest)).resolves.toBe(false);
  });

  it('does not need rehashing a current digest', async () => {
    expect(hasher.needsRehash(await hasher.hash('x'))).toBe(false);
  });

  describe('legacy unsalted SHA-256 digests', () => {
    const legacy = createHash('sha256').update('legacy-pass').digest('hex');

    it('still verifies, so existing accounts keep signing in', async () => {
      await expect(hasher.verify('legacy-pass', legacy)).resolves.toBe(true);
      await expect(hasher.verify('wrong', legacy)).resolves.toBe(false);
    });

    it('is flagged for rehash so the digest upgrades on next login', () => {
      expect(hasher.needsRehash(legacy)).toBe(true);
    });
  });

  it('treats a malformed digest as a failed verification, not a crash', async () => {
    await expect(hasher.verify('x', 'scrypt$nothex$nothex')).resolves.toBe(false);
    await expect(hasher.verify('x', 'scrypt$$')).resolves.toBe(false);
    await expect(hasher.verify('x', 'bcrypt$whatever')).resolves.toBe(false);
    await expect(hasher.verify('x', '')).resolves.toBe(false);
  });
});
