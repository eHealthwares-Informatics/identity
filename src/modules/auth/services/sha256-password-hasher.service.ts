import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PasswordHasherPort } from './password-hasher.port';

@Injectable()
export class Sha256PasswordHasherService implements PasswordHasherPort {
  async hash(raw: string): Promise<string> {
    return createHash('sha256').update(raw).digest('hex');
  }

  async verify(raw: string, digest: string): Promise<boolean> {
    const hashed = await this.hash(raw);
    return hashed === digest;
  }
}
