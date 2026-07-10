export class User {
  constructor(
    public readonly id: string,
    public readonly organizationId: string | null,
    public readonly locationId: string | null,
    public readonly username: string,
    public passwordHash: string,
    public readonly isActive: boolean,
    public roleCodes: string[] = [],
    public roles: any[] = [],
    public readonly phone?: string,
    public readonly email?: string,
  ) {}
}
