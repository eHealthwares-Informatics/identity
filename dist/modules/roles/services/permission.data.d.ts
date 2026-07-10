import { ModuleInfoDto } from '../dto/module-info.dto';
export declare const AVAILABLE_MODULES: ModuleInfoDto[];
export declare function getUserModules(permissions: string[], roleCodes?: string[]): ModuleInfoDto[];
