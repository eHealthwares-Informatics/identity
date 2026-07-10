import { AssignRoleDto } from '../dto/assign-role.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { AssignRoleUseCase } from '../services/assign-role.use-case';
import { CreateUserUseCase } from '../services/create-user.use-case';
import { UpdateUserUseCase } from '../services/update-user.use-case';
import { DeleteUserUseCase } from '../services/delete-user.use-case';
import { ListUsersUseCase } from '../services/list-users.use-case';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import type { UserRepository } from '../repositories/user.repository';
type UsersListResponse = {
    data: UserResponseDto[];
    meta: {
        page: number;
        limit: number;
        total: number;
    };
};
export declare class UsersController {
    private readonly createUserUseCase;
    private readonly assignRoleUseCase;
    private readonly updateUserUseCase;
    private readonly deleteUserUseCase;
    private readonly listUsersUseCase;
    private readonly userRepository;
    constructor(createUserUseCase: CreateUserUseCase, assignRoleUseCase: AssignRoleUseCase, updateUserUseCase: UpdateUserUseCase, deleteUserUseCase: DeleteUserUseCase, listUsersUseCase: ListUsersUseCase, userRepository: UserRepository);
    private toResponse;
    create(payload: CreateUserDto, currentUser: RequestUser): Promise<UserResponseDto>;
    list(page: number | undefined, limit: number | undefined, search: string | undefined, currentUser: RequestUser): Promise<UsersListResponse>;
    getById(id: string, currentUser: RequestUser): Promise<UserResponseDto>;
    update(id: string, payload: UpdateUserDto, currentUser: RequestUser): Promise<UserResponseDto>;
    delete(id: string, currentUser: RequestUser): Promise<void>;
    assignRole(userId: string, payload: AssignRoleDto, currentUser: RequestUser): Promise<UserResponseDto>;
}
export {};
