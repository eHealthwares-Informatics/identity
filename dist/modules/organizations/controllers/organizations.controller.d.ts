export declare class OrganizationsController {
    constructor();
    list(page?: number, limit?: number, search?: string): Promise<{
        data: never[];
    }>;
    getById(id: string): Promise<{
        id: string;
    }>;
    create(payload: any): Promise<any>;
    update(id: string, payload: any): Promise<any>;
    delete(id: string): Promise<{
        ok: boolean;
    }>;
}
