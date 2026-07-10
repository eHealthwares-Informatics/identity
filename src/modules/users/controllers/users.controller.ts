import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { AssignRoleUseCase } from '../services/assign-role.use-case';
import { CreateUserUseCase } from '../services/create-user.use-case';
import { UpdateUserUseCase } from '../services/update-user.use-case';
import { DeleteUserUseCase } from '../services/delete-user.use-case';
import { ListUsersUseCase } from '../services/list-users.use-case';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { USER_REPOSITORY } from '../../auth/services/identity.di-tokens';
import type { UserRepository } from '../repositories/user.repository';

type UsersListResponse = {
  data: UserResponseDto[];
  meta: { page: number; limit: number; total: number };
};

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly assignRoleUseCase: AssignRoleUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  private toResponse(user: any): UserResponseDto {
    return {
      id: user.id,
      organizationId: user.organizationId,
      locationId: user.locationId,
      username: user.username,
      phone: user.phone,
      email: user.email,
      roles: user.roleCodes ?? [],
      isActive: user.isActive,
    };
  }

  @Post()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create a user account' })
  async create(@Body() payload: CreateUserDto, @CurrentUser() currentUser: RequestUser): Promise<UserResponseDto> {
    const user = await this.createUserUseCase.execute(payload, currentUser.organizationId);
    return this.toResponse(user);
  }

  @Get()
  @Roles('admin', 'super_admin', 'auditor')
  @ApiOperation({ summary: 'List users with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'john', description: 'Search by username, email, or phone' })
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<UsersListResponse> {
    const offset = (page - 1) * limit;
    const result = await this.listUsersUseCase.execute(offset, limit, currentUser.organizationId ?? '');
    return {
      data: result.items.map(this.toResponse),
      meta: { page, limit, total: result.total },
    };
  }

  @Get(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get user by ID' })
  async getById(@Param('id') id: string, @CurrentUser() currentUser: RequestUser): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponse(user);
  }

  @Put(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateUserDto,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserUseCase.execute(id, payload, currentUser.organizationId);
    return this.toResponse(user);
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Delete a user' })
  async delete(@Param('id') id: string, @CurrentUser() currentUser: RequestUser): Promise<void> {
    await this.deleteUserUseCase.execute(id, currentUser.organizationId ?? '');
  }

  @Patch(':userId/roles')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @Param('userId') userId: string,
    @Body() payload: AssignRoleDto,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<UserResponseDto> {
    const user = await this.assignRoleUseCase.execute(userId, payload, currentUser.organizationId ?? '');
    return this.toResponse(user);
  }
}
