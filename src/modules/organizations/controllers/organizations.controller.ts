import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListOrganizationsUseCase } from '../services/list-organizations.use-case';
import { GetOrganizationUseCase } from '../services/get-organization.use-case';
import { CreateOrganizationUseCase } from '../services/create-organization.use-case';
import { UpdateOrganizationUseCase } from '../services/update-organization.use-case';
import { DeleteOrganizationUseCase } from '../services/delete-organization.use-case';
import { ResolveOrganizationByDomainUseCase } from '../services/resolve-organization-by-domain.use-case';
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
    private readonly resolveOrganizationByDomainUseCase: ResolveOrganizationByDomainUseCase,
  ) {
    this.logger = new Logger(OrganizationsController.name);
  }

  private readonly logger: Logger;

  private toResponse(organization: Organization): OrganizationResponseDto {
    return {
      id: organization.id,
      code: organization.code,
      name: organization.name,
      isActive: organization.isActive,
      domain: organization.domain,
    };
  }

  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'Acme', description: 'Search by organization name or code' })
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ): Promise<OrganizationsListResponse> {
    this.logger.debug(`List organizations: page=${page} limit=${limit} search=${search ?? ''}`);
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
    this.logger.debug(`Get organization: id=${id}`);
    const organization = await this.getOrganizationUseCase.execute(id);
    if (!organization) {
      this.logger.warn(`Organization not found: id=${id}`);
      throw new NotFoundException('Organization not found');
    }
    return this.toResponse(organization);
  }

  @Public()
  @Get('domain/:domain')
  @ApiOperation({
    summary: 'Resolve organization by domain (website/public)',
    description: 'Returns the organization matching the given domain. Used by website flows to map a domain to an organisationId.',
  })
  async resolveByDomain(
    @Param('domain') domain: string,
  ): Promise<{ organizationId: string | null; code: string | null; name: string | null }> {
    this.logger.debug(`Resolve organization by domain: domain=${domain}`);
    const organization = await this.resolveOrganizationByDomainUseCase.execute(domain);
    if (!organization) {
      return { organizationId: null, code: null, name: null };
    }
    return {
      organizationId: organization.id,
      code: organization.code,
      name: organization.name,
    };
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create an organization' })
  async create(@Body() payload: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    this.logger.log(`Create organization attempt: code=${payload.code} name=${payload.name}`);
    try {
      const organization = await this.createOrganizationUseCase.execute(payload);
      this.logger.log(`Organization created: id=${organization.id} code=${payload.code}`);
      return this.toResponse(organization);
    } catch (error) {
      this.logger.warn(
        `Create organization failed: code=${payload.code} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  @Put(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update an organization' })
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    this.logger.log(`Update organization attempt: id=${id} name=${payload.name}`);
    try {
      const organization = await this.updateOrganizationUseCase.execute(id, payload);
      this.logger.log(`Organization updated: id=${id}`);
      return this.toResponse(organization);
    } catch (error) {
      this.logger.warn(
        `Update organization failed: id=${id} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }

  @Delete(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete an organization' })
  async delete(@Param('id') id: string): Promise<{ ok: boolean }> {
    this.logger.log(`Delete organization attempt: id=${id}`);
    try {
      await this.deleteOrganizationUseCase.execute(id);
      this.logger.log(`Organization deleted: id=${id}`);
      return { ok: true };
    } catch (error) {
      this.logger.warn(
        `Delete organization failed: id=${id} reason=${String((error as Error)?.message)}`,
      );
      throw error;
    }
  }
}
