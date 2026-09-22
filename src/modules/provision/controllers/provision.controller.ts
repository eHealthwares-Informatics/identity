import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ProvisionService } from '../services/provision.service';
import { ProvisionOrganisationDto } from '../dto/provision-organisation.dto';

// HTTP surface for onboarding / provisioning organisations. Intentionally
// public (the login page's "Onboard your Organisation" flow and the E2E
// harness call it unauthenticated); every mutating endpoint is gated by
// ONBOARD_ORGANISATIONS_ENABLED so production can switch the whole surface
// off with one env var.
@ApiTags('provision')
@Controller('provision')
export class ProvisionController {
  constructor(
    private readonly provisionService: ProvisionService,
    private readonly config: ConfigService,
  ) {}

  private assertEnabled(): void {
    const enabled =
      this.config.get<string>('ONBOARD_ORGANISATIONS_ENABLED', 'true') === 'true';
    if (!enabled) {
      throw new ServiceUnavailableException('Organisation provisioning is not enabled');
    }
  }

  @Get('health')
  health() {
    return {
      ok: true,
      enabled:
        this.config.get<string>('ONBOARD_ORGANISATIONS_ENABLED', 'true') === 'true',
    };
  }

  // POST /provision — provision a fresh organisation (idempotent by code).
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Provision a new organisation (org, roles, users + reference data)',
  })
  async provision(@Body() dto: ProvisionOrganisationDto) {
    this.assertEnabled();
    return { organisation: await this.provisionService.provision(dto) };
  }

  // GET /provision/status/:code — check whether an organisation is provisioned.
  @Get('status/:code')
  async status(@Param('code') code: string) {
    this.assertEnabled();
    return this.provisionService.status(code);
  }

  // DELETE /provision/:code — tear down the organisation (idempotent).
  @Delete(':code')
  async deprovision(@Param('code') code: string) {
    this.assertEnabled();
    const removed = await this.provisionService.deprovision(code);
    return { deprovisioned: removed };
  }
}
