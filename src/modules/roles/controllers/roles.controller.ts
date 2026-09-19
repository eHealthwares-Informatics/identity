import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleResponseDto } from '../dto/role-response.dto';
import { CreateRoleUseCase } from '../services/create-role.use-case';
import { ListRolesUseCase } from '../services/list-roles.use-case';
import { GetRoleUseCase } from '../services/get-role.use-case';
import { UpdateRoleUseCase } from '../services/update-role.use-case';
import { DeleteRoleUseCase } from '../services/delete-role.use-case';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

function toResponse(role: { id: string; code: string; name: string; description: string | null; permissionCodes: string[] }): RoleResponseDto {
  return { id: role.id, code: role.code, name: role.name, description: role.description, permissionCodes: role.permissionCodes };
}

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly getRoleUseCase: GetRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
  ) {}

  @Post()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create a role' })
  async create(@Body() payload: CreateRoleDto, @CurrentUser() currentUser: RequestUser): Promise<RoleResponseDto> {
    const role = await this.createRoleUseCase.execute(payload, currentUser.organizationId ?? '');
    return toResponse(role);
  }

  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all roles' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'admin', description: 'Search by role code or name' })
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<RoleResponseDto[]> {
    const roles = await this.listRolesUseCase.execute(currentUser.organizationId ?? '');
    return roles.map(toResponse);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'List requestable roles (codes + names) for any authenticated user' })
  async catalog(@CurrentUser() currentUser: RequestUser): Promise<Array<{ code: string; name: string }>> {
    const roles = await this.listRolesUseCase.execute(currentUser.organizationId ?? '');
    return roles.map((r) => ({ code: r.code, name: r.name }));
  }

  @Get(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get a role by ID' })
  async getById(@Param('id') id: string, @CurrentUser() currentUser: RequestUser): Promise<RoleResponseDto> {
    const role = await this.getRoleUseCase.execute(id, currentUser.organizationId ?? '');
    return toResponse(role);
  }

  @Put(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update a role' })
  async update(@Param('id') id: string, @Body() payload: UpdateRoleDto, @CurrentUser() currentUser: RequestUser): Promise<RoleResponseDto> {
    const role = await this.updateRoleUseCase.execute(id, payload, currentUser.organizationId ?? '');
    return toResponse(role);
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Delete a role' })
  async delete(@Param('id') id: string, @CurrentUser() currentUser: RequestUser): Promise<void> {
    await this.deleteRoleUseCase.execute(id, currentUser.organizationId ?? '');
  }
}
