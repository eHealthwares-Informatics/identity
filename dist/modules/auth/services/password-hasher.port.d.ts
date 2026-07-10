export interface PasswordHasherPort {
    hash(raw: string): Promise<string>;
    verify(raw: string, digest: string): Promise<boolean>;
}
