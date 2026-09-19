import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CreateRoleRequestDto, UpdateRoleRequestDto } from '../dto/role-request.dto';
import { RoleRequestService, RoleRequestView } from '../services/role-request.service';

@ApiTags('role-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('role-requests')
export class RoleRequestsController {
  constructor(private readonly service: RoleRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Request a role for the current user' })
  request(@Body() payload: CreateRoleRequestDto, @CurrentUser() user: RequestUser): Promise<RoleRequestView> {
    return this.service.request(user.sub, user.organizationId ?? null, payload);
  }

  @Get('my')
  @ApiOperation({ summary: 'List my role requests' })
  mine(@CurrentUser() user: RequestUser): Promise<RoleRequestView[]> {
    return this.service.listMine(user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all role requests (admin)' })
  list(@Query('status') _status: string | undefined): Promise<RoleRequestView[]> {
    return this.service.listAll();
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Approve a role request and assign the role (admin)' })
  approve(
    @Param('id') id: string,
    @Body() payload: UpdateRoleRequestDto,
    @CurrentUser() user: RequestUser,
  ): Promise<RoleRequestView> {
    return this.service.decide(id, 'approve', user.sub, payload.roleCode);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Reject a role request (admin)' })
  reject(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<RoleRequestView> {
    return this.service.decide(id, 'reject', user.sub);
  }
}