import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionModuleResponseDto } from '../dto/permission-module-response.dto';
import { ExpandPermissionsDto } from '../dto/expand-permissions.dto';
import { MODULE_PERMISSIONS } from '../services/permission-definitions.data';
import { PermissionCatalogService } from '../services/permission-catalog.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly catalog: PermissionCatalogService) {}

  @Get('modules')
  @ApiOperation({ summary: 'Get all permissions grouped by module' })
  listModules(): PermissionModuleResponseDto[] {
    return MODULE_PERMISSIONS;
  }

  /**
   * Concrete catalog codes. Consumers that grant permissions (the provisioner)
   * should resolve grants against this rather than reading the `permissions`
   * table directly, so they always see the catalog the service is running.
   */
  @Get('codes')
  @ApiOperation({ summary: 'List every concrete permission code in the catalog' })
  listCodes(): { codes: string[]; total: number } {
    const codes = this.catalog.codes();
    return { codes, total: codes.length };
  }

  /**
   * Resolves granted codes — including wildcards — to concrete catalog codes.
   * Role→permission links are rows, so a wildcard (`rxsoft.catalog.*`) can never
   * be stored; callers expand first, then link the concrete codes.
   */
  @Post('expand')
  @ApiOperation({ summary: 'Expand wildcard grants to concrete catalog codes' })
  expand(@Body() dto: ExpandPermissionsDto): { codes: string[]; total: number } {
    const codes = this.catalog.expand(dto.codes ?? []);
    return { codes, total: codes.length };
  }
}
