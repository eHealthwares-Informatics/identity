export type RequestUser = {
    sub: string;
    organizationId: string;
    locationId: string | null;
    username: string;
    roles: string[];
    permissions: string[];
};
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
