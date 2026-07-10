import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor() {}

  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Items per page' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'Acme', description: 'Search by organization name' })
  async list(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return { data: [] };
  }

  @Get(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get organization by ID' })
  async getById(@Param('id') id: string) {
    return { id };
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create an organization' })
  async create(@Body() payload: any) {
    return payload;
  }

  @Put(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update an organization' })
  async update(@Param('id') id: string, @Body() payload: any) {
    return { id, ...payload };
  }

  @Delete(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete an organization' })
  async delete(@Param('id') id: string) {
    return { ok: true };
  }
}
