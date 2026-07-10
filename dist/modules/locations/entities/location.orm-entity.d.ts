export declare class LocationOrmEntity {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    parentId: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}
