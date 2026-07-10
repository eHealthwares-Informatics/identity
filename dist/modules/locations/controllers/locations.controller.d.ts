import type { RequestUser } from '../../../common/decorators/current-user.decorator';
export declare class LocationsController {
    constructor();
    list(page: number | undefined, limit: number | undefined, search: string | undefined, currentUser: RequestUser): Promise<{
        data: never[];
    }>;
    getById(id: string): Promise<{
        id: string;
    }>;
    create(payload: any, currentUser: RequestUser): Promise<any>;
    update(id: string, payload: any): Promise<any>;
    delete(id: string): Promise<{
        ok: boolean;
    }>;
}
