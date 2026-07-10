export declare class UserOrmEntity {
    id: string;
    organizationId: string | null;
    locationId: string | null;
    username: string;
    passwordHash: string;
    isActive: boolean;
    phone?: string;
    email?: string;
    roles: any[];
    refreshTokens: any[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}
