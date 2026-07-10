export declare class RoleOrmEntity {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    description: string | null;
    permissions: any[];
    users: any[];
    createdAt: Date;
    updatedAt: Date;
}
