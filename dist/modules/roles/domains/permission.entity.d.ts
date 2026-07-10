export declare class Permission {
    readonly id: string;
    readonly code: string;
    readonly resource: string;
    readonly action: string;
    readonly description: string | null;
    constructor(id: string, code: string, resource: string, action: string, description: string | null);
}
