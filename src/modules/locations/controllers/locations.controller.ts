import { Body, Controller, Delete, Get, Logger, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListLocationsUseCase } from '../services/list-locations.use-case';
import { GetLocationUseCase } from '../services/get-location.use-case';
import { CreateLocationUseCase } from '../services/create-location.use-case';
import { UpdateLocationUseCase } from '../services/update-location.use-case';
import { DeleteLocationUseCase } from '../services/delete-location.use-case';
import { Location } from '../domains/location.entity';
import { CreateLocationDto } from '../dto/create-location.dto';
import { UpdateLocationDto } from '../dto/update-location.dto';

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
    private readonly createLocationUseCase: CreateLocationUseCase,
    private readonly updateLocationUseCase: UpdateLocationUseCase,
    private readonly deleteLocationUseCase: DeleteLocationUseCase,
  ) {
    this.logger = new Logger(LocationsController.name);
  }

  private readonly logger: Logger;

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
  @ApiQuery({ name: 'parentId', required: false, type: String, description: 'Filter by parent location id (root sites when omitted are all; use empty to list root sites only)' })
  @ApiQuery({ name: 'organizationId', required: false, type: String, description: 'Org scope override (service-to-service only)' })
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search: string | undefined,
    @Query('parentId') parentId: string | undefined,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<LocationsListResponse> {
    const offset = (page - 1) * limit;
    this.logger.debug(
      `List locations: page=${page} limit=${limit} search=${search ?? ''} parentId=${parentId ?? ''} org=${currentUser.organizationId ?? null}`,
    );
    const result = await this.listLocationsUseCase.execute(
      offset,
      limit,
      this.resolveOrganizationId(organizationId, currentUser),
      search,
      parentId,
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
    this.logger.debug(`Get location: id=${id} org=${currentUser.organizationId ?? null}`);
    const location = await this.getLocationUseCase.execute(
      id,
      this.resolveOrganizationId(organizationId, currentUser),
    );
    if (!location) {
      this.logger.warn(`Location not found: id=${id} org=${currentUser.organizationId ?? null}`);
      throw new NotFoundException('Location not found');
    }
    return this.toResponse(location);
  }

  @Post()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create a location' })
  async create(
    @Body() payload: CreateLocationDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<LocationResponse> {
    const orgId = this.resolveOrganizationId(organizationId, currentUser);
    this.logger.log(`Create location attempt: code=${payload.code} name=${payload.name} org=${orgId}`);
    try {
      const location = await this.createLocationUseCase.execute(payload, orgId);
      this.logger.log(`Location created: id=${location.id} code=${payload.code} org=${orgId}`);
      return this.toResponse(location);
    } catch (error) {
      this.logger.warn(
        `Create location failed: code=${payload.code} org=${orgId} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  @Put(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Replace a location' })
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateLocationDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<LocationResponse> {
    const orgId = this.resolveOrganizationId(organizationId, currentUser);
    this.logger.log(`Update location attempt: id=${id} code=${payload.code ?? '<unchanged>'} org=${orgId}`);
    try {
      const location = await this.updateLocationUseCase.execute(id, payload, orgId);
      this.logger.log(`Location updated: id=${id} org=${orgId}`);
      return this.toResponse(location);
    } catch (error) {
      this.logger.warn(
        `Update location failed: id=${id} org=${orgId} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  @Patch(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Partially update a location' })
  async patch(
    @Param('id') id: string,
    @Body() payload: UpdateLocationDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<LocationResponse> {
    const orgId = this.resolveOrganizationId(organizationId, currentUser);
    this.logger.log(`Patch location attempt: id=${id} code=${payload.code ?? '<unchanged>'} org=${orgId}`);
    try {
      const location = await this.updateLocationUseCase.execute(id, payload, orgId);
      this.logger.log(`Location patched: id=${id} org=${orgId}`);
      return this.toResponse(location);
    } catch (error) {
      this.logger.warn(
        `Patch location failed: id=${id} org=${orgId} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Delete a location' })
  async delete(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() currentUser: RequestUser,
  ): Promise<{ ok: boolean }> {
    const orgId = this.resolveOrganizationId(organizationId, currentUser);
    this.logger.log(`Delete location attempt: id=${id} org=${orgId}`);
    try {
      await this.deleteLocationUseCase.execute(id, orgId);
      this.logger.log(`Location deleted: id=${id} org=${orgId}`);
      return { ok: true };
    } catch (error) {
      this.logger.warn(
        `Delete location failed: id=${id} org=${orgId} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }
}