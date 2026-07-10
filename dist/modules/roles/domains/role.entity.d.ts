export declare class Role {
    readonly id: string;
    readonly organizationId: string;
    readonly code: string;
    readonly name: string;
    readonly description: string | null;
    readonly permissionCodes: string[];
    readonly permissions: any[];
    constructor(id: string, organizationId: string, code: string, name: string, description: string | null, permissionCodes?: string[], permissions?: any[]);
}
