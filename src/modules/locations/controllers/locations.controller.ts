import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListLocationsUseCase } from '../services/list-locations.use-case';
import { GetLocationUseCase } from '../services/get-location.use-case';
import { Location } from '../domains/location.entity';

type LocationResponse = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
};

type LocationsListResponse = {
  data: LocationResponse[];
  meta: { page: number; limit: number; total: number };
};

@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('locations')
export class LocationsController {
  constructor(
    private readonly listLocationsUseCase: ListLocationsUseCase,
    private readonly getLocationUseCase: GetLocationUseCase,
  ) {}

  private toResponse(location: Location): LocationResponse {
    return {
      id: location.id,
      organizationId: location.organizationId,
      code: location.code,
      name: location.name,
      parentId: location.parentId,
      isActive: location.isActive,
    };
  }

  /** Service-to-service calls (x-api-key) may pass an explicit org scope. */
  private resolveOrganizationId(organizationId: string | undefined, currentUser: RequestUser): string {
    if (currentUser.sub === 'system' && organizationId) {
      return organizationId;
    }
    return currentUser.organizationId ?? '';
  }

  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List locations for the organization with search and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'Warehouse', description: 'Search by location name or code' })
  @ApiQuery({ name: 'organizationId', required: false, type: String, description: 'Org scope override (service-to-service only)' })
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search: string | undefined,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<LocationsListResponse> {
    const offset = (page - 1) * limit;
    const result = await this.listLocationsUseCase.execute(
      offset,
      limit,
      this.resolveOrganizationId(organizationId, currentUser),
      search,
    );
    return {
      data: result.items.map((location) => this.toResponse(location)),
      meta: { page, limit, total: result.total },
    };
  }

  @Get(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get location by ID' })
  async getById(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<LocationResponse> {
    const location = await this.getLocationUseCase.execute(
      id,
      this.resolveOrganizationId(organizationId, currentUser),
    );
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    return this.toResponse(location);
  }

  @Post()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create a location' })
  async create(@Body() payload: any, @CurrentUser() currentUser: RequestUser) {
    return { ...payload, organizationId: currentUser.organizationId };
  }

  @Put(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update a location' })
  async update(@Param('id') id: string, @Body() payload: any) {
    return { id, ...payload };
  }

  @Patch(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Partially update a location' })
  async patch(@Param('id') id: string, @Body() payload: any) {
    return { id, ...payload };
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Delete a location' })
  async delete(@Param('id') id: string) {
    return { ok: true };
  }
}
