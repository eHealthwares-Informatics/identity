export declare class UserResponseDto {
    id: string;
    organizationId: string | null;
    locationId: string | null;
    username: string;
    phone?: string;
    email?: string;
    roles: string[];
    isActive: boolean;
}
