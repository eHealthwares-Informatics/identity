import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionModuleResponseDto } from '../dto/permission-module-response.dto';
import { MODULE_PERMISSIONS } from '../services/permission-definitions.data';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  @Get('modules')
  @ApiOperation({ summary: 'Get all permissions grouped by module' })
  listModules(): PermissionModuleResponseDto[] {
    return MODULE_PERMISSIONS;
  }
}
