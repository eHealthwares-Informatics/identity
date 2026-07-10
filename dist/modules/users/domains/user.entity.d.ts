export declare class User {
    readonly id: string;
    readonly organizationId: string | null;
    readonly locationId: string | null;
    readonly username: string;
    passwordHash: string;
    readonly isActive: boolean;
    roleCodes: string[];
    roles: any[];
    readonly phone?: string | undefined;
    readonly email?: string | undefined;
    constructor(id: string, organizationId: string | null, locationId: string | null, username: string, passwordHash: string, isActive: boolean, roleCodes?: string[], roles?: any[], phone?: string | undefined, email?: string | undefined);
}
