import { Body, Controller, Delete, Get, Inject, Logger, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { EnsureCustomerUserDto } from '../dto/ensure-customer-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { AssignRoleUseCase } from '../services/assign-role.use-case';
import { CreateUserUseCase } from '../services/create-user.use-case';
import { EnsureCustomerUserUseCase } from '../services/ensure-customer-user.use-case';
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
    private readonly ensureCustomerUserUseCase: EnsureCustomerUserUseCase,
    private readonly assignRoleUseCase: AssignRoleUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {
    this.logger = new Logger(UsersController.name);
  }

  private readonly logger: Logger;

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
      loginTimeoutMinutes: user.loginTimeoutMinutes ?? null,
      firstName: user.profile?.firstName ?? null,
      lastName: user.profile?.lastName ?? null,
      displayName: user.profile?.displayName ?? null,
      dateOfBirth: user.profile?.dateOfBirth ?? null,
      gender: user.profile?.gender ?? null,
      pictureUrl: user.profile?.pictureUrl ?? null,
      locale: user.profile?.locale ?? null,
      oauthProvider: user.profile?.oauthProvider ?? null,
    };
  }

  @Post()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create a user account' })
  async create(@Body() payload: CreateUserDto, @CurrentUser() currentUser: RequestUser): Promise<UserResponseDto> {
    this.logger.log(
      `Create user attempt: username=${payload.username} org=${currentUser.organizationId ?? null} actor=${currentUser.sub}`,
    );
    try {
      const user = await this.createUserUseCase.execute(payload, currentUser.organizationId);
      this.logger.log(`User created: id=${user.id} username=${payload.username} org=${currentUser.organizationId ?? null}`);
      return this.toResponse(user);
    } catch (error) {
      this.logger.warn(
        `Create user failed: username=${payload.username} org=${currentUser.organizationId ?? null} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  /**
   * Service-to-service (x-api-key): find or create the website user for a
   * customer's phone number. Idempotent, so rxsoft can call it on customer
   * creation and again when generating a payment link.
   */
  @Post('ensure-customer')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Find or create the website user for a customer phone' })
  async ensureCustomer(
    @Body() payload: EnsureCustomerUserDto,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `Ensure customer user attempt: phone=${payload.phone} org=${currentUser.organizationId ?? null} actor=${currentUser.sub}`,
    );
    try {
      const user = await this.ensureCustomerUserUseCase.execute(payload, currentUser);
      this.logger.log(
        `Customer user ensured: id=${user.id} phone=${payload.phone} org=${currentUser.organizationId ?? null}`,
      );
      return this.toResponse(user);
    } catch (error) {
      this.logger.warn(
        `Ensure customer user failed: phone=${payload.phone} org=${currentUser.organizationId ?? null} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
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
    const result = await this.listUsersUseCase.execute(
      offset,
      limit,
      currentUser.organizationId ?? '',
      search,
    );
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
      this.logger.warn(`User not found: id=${id} requested by actor=${currentUser.sub}`);
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
    this.logger.log(
      `Update user attempt: id=${id} org=${currentUser.organizationId ?? null} actor=${currentUser.sub}`,
    );
    try {
      const user = await this.updateUserUseCase.execute(id, payload, currentUser.organizationId);
      this.logger.log(`User updated: id=${user.id} org=${currentUser.organizationId ?? null}`);
      return this.toResponse(user);
    } catch (error) {
      this.logger.warn(
        `Update user failed: id=${id} org=${currentUser.organizationId ?? null} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  @Patch(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Partially update a user' })
  async patch(
    @Param('id') id: string,
    @Body() payload: UpdateUserDto,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `Patch user attempt: id=${id} org=${currentUser.organizationId ?? null} actor=${currentUser.sub}`,
    );
    try {
      const user = await this.updateUserUseCase.execute(id, payload, currentUser.organizationId);
      this.logger.log(`User patched: id=${user.id} org=${currentUser.organizationId ?? null}`);
      return this.toResponse(user);
    } catch (error) {
      this.logger.warn(
        `Patch user failed: id=${id} org=${currentUser.organizationId ?? null} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Delete a user' })
  async delete(@Param('id') id: string, @CurrentUser() currentUser: RequestUser): Promise<void> {
    this.logger.log(
      `Delete user attempt: id=${id} org=${currentUser.organizationId ?? null} actor=${currentUser.sub}`,
    );
    try {
      await this.deleteUserUseCase.execute(id, currentUser.organizationId ?? '');
      this.logger.log(`User deleted: id=${id} org=${currentUser.organizationId ?? null}`);
    } catch (error) {
      this.logger.warn(
        `Delete user failed: id=${id} org=${currentUser.organizationId ?? null} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  @Patch(':userId/roles')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @Param('userId') userId: string,
    @Body() payload: AssignRoleDto,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `Assign role attempt: userId=${userId} role=${payload.roleCode} org=${currentUser.organizationId ?? null} actor=${currentUser.sub}`,
    );
    try {
      const user = await this.assignRoleUseCase.execute(userId, payload, currentUser.organizationId ?? '');
      this.logger.log(
        `Role assigned: userId=${userId} role=${payload.roleCode} org=${currentUser.organizationId ?? null}`,
      );
      return this.toResponse(user);
    } catch (error) {
      this.logger.warn(
        `Assign role failed: userId=${userId} role=${payload.roleCode} org=${currentUser.organizationId ?? null} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }
}
