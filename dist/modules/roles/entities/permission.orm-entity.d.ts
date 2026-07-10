export declare class PermissionOrmEntity {
    id: string;
    code: string;
    resource: string;
    action: string;
    description: string | null;
    roles: any[];
    createdAt: Date;
    updatedAt: Date;
}
