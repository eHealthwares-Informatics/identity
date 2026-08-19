import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListOrganizationsUseCase } from '../services/list-organizations.use-case';
import { GetOrganizationUseCase } from '../services/get-organization.use-case';
import { CreateOrganizationUseCase } from '../services/create-organization.use-case';
import { UpdateOrganizationUseCase } from '../services/update-organization.use-case';
import { DeleteOrganizationUseCase } from '../services/delete-organization.use-case';
import { Organization } from '../domains/organization.entity';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { OrganizationResponseDto } from '../dto/organization-response.dto';

type OrganizationsListResponse = {
  data: OrganizationResponseDto[];
  meta: { page: number; limit: number; total: number };
};

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly listOrganizationsUseCase: ListOrganizationsUseCase,
    private readonly getOrganizationUseCase: GetOrganizationUseCase,
    private readonly createOrganizationUseCase: CreateOrganizationUseCase,
    private readonly updateOrganizationUseCase: UpdateOrganizationUseCase,
    private readonly deleteOrganizationUseCase: DeleteOrganizationUseCase,
  ) {}

  private toResponse(organization: Organization): OrganizationResponseDto {
    return {
      id: organization.id,
      code: organization.code,
      name: organization.name,
      isActive: organization.isActive,
    };
  }

  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'Acme', description: 'Search by organization name or code' })
  async list(
    @CurrentUser() _currentUser: RequestUser,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ): Promise<OrganizationsListResponse> {
    const offset = (page - 1) * limit;
    const result = await this.listOrganizationsUseCase.execute(offset, limit, search);
    return {
      data: result.items.map((organization) => this.toResponse(organization)),
      meta: { page, limit, total: result.total },
    };
  }

  @Get(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get organization by ID' })
  async getById(@Param('id') id: string): Promise<OrganizationResponseDto> {
    const organization = await this.getOrganizationUseCase.execute(id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return this.toResponse(organization);
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create an organization' })
  async create(@Body() payload: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const organization = await this.createOrganizationUseCase.execute(payload);
    return this.toResponse(organization);
  }

  @Put(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update an organization' })
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const organization = await this.updateOrganizationUseCase.execute(id, payload);
    return this.toResponse(organization);
  }

  @Delete(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete an organization' })
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.deleteOrganizationUseCase.execute(id);
    return { ok: true };
  }
}