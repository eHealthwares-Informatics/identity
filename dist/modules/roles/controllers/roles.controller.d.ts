import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleResponseDto } from '../dto/role-response.dto';
import { CreateRoleUseCase } from '../services/create-role.use-case';
import { ListRolesUseCase } from '../services/list-roles.use-case';
import { GetRoleUseCase } from '../services/get-role.use-case';
import { UpdateRoleUseCase } from '../services/update-role.use-case';
import { DeleteRoleUseCase } from '../services/delete-role.use-case';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
export declare class RolesController {
    private readonly createRoleUseCase;
    private readonly listRolesUseCase;
    private readonly getRoleUseCase;
    private readonly updateRoleUseCase;
    private readonly deleteRoleUseCase;
    constructor(createRoleUseCase: CreateRoleUseCase, listRolesUseCase: ListRolesUseCase, getRoleUseCase: GetRoleUseCase, updateRoleUseCase: UpdateRoleUseCase, deleteRoleUseCase: DeleteRoleUseCase);
    create(payload: CreateRoleDto, currentUser: RequestUser): Promise<RoleResponseDto>;
    list(page: number | undefined, limit: number | undefined, search: string | undefined, currentUser: RequestUser): Promise<RoleResponseDto[]>;
    getById(id: string, currentUser: RequestUser): Promise<RoleResponseDto>;
    update(id: string, payload: UpdateRoleDto, currentUser: RequestUser): Promise<RoleResponseDto>;
    delete(id: string, currentUser: RequestUser): Promise<void>;
}
