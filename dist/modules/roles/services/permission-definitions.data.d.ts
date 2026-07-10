export interface ModulePermissionDefinition {
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
export declare const MODULE_PERMISSIONS: ModulePermissionDefinition[];
