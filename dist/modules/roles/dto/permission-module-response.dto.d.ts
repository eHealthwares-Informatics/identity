export declare class PermissionModuleResponseDto {
    module: string;
    moduleDisplayName: string;
    permissions: Array<{
        code: string;
        name: string;
        description: string;
        resource: string;
        action: string;
    }>;
}
