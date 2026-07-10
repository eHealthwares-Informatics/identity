export declare class RefreshTokenOrmEntity {
    id: string;
    user: any;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
}
