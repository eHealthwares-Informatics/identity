import { PasswordHasherPort } from './password-hasher.port';
export declare class Sha256PasswordHasherService implements PasswordHasherPort {
    hash(raw: string): Promise<string>;
    verify(raw: string, digest: string): Promise<boolean>;
}
