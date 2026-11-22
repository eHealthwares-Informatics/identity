import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ProvisionService } from '../services/provision.service';
import { ProvisioningJobService } from '../services/provisioning-job.service';
import { ProvisionOrganisationDto } from '../dto/provision-organisation.dto';

// HTTP surface for onboarding / provisioning organisations. Intentionally
// public (the login page's "Onboard your Organisation" flow and the E2E
// harness call it unauthenticated); every mutating endpoint is gated by
// ONBOARD_ORGANISATIONS_ENABLED so production can switch the whole surface
// off with one env var.
//
// Provisioning is asynchronous: POST returns 202 with the job state, and the
// client polls GET /provision/status/:code. This keeps the gateway read
// timeout and the container memory limit out of the critical path.
@ApiTags('provision')
@Controller('provision')
export class ProvisionController {
  private readonly logger = new Logger(ProvisionController.name);

  constructor(
    private readonly provisionService: ProvisionService,
    private readonly jobs: ProvisioningJobService,
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

  // POST /provision — queue a provisioning job (idempotent by code).
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue organisation provisioning (202; poll /provision/status/:code)',
  })
  async provision(@Body() dto: ProvisionOrganisationDto) {
    this.assertEnabled();
    return { organisation: await this.jobs.createOrGet(dto) };
  }

  // GET /provision/status/:code — job state + provisioned row counts.
  @Get('status/:code')
  async status(@Param('code') code: string) {
    return this.jobs.status(code);
  }

  // POST /provision/:code/resume — retry a failed/interrupted job.
  @Post(':code/resume')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Resume a failed or interrupted provisioning job' })
  async resume(@Param('code') code: string) {
    this.assertEnabled();
    return { organisation: await this.jobs.resume(code) };
  }

  // DELETE /provision/:code — tear down the organisation (idempotent).
  // The body carries per-table results, so a partial cleanup is visible to the
  // caller instead of a bare `deprovisioned: true` (identity#2). The headline
  // boolean is true only when every table was emptied.
  @Delete(':code')
  async deprovision(@Param('code') code: string) {
    this.assertEnabled();
    const outcome = await this.provisionService.deprovision(code);
    if (outcome.status === 'partial') {
      this.logger.warn(
        `[deprovision:${code.toUpperCase()}] partial cleanup — ` +
          outcome.failures.map((f) => `${f.name}: ${f.error ?? f.outcome}`).join('; '),
      );
    }
    return {
      deprovisioned: outcome.deprovisioned,
      status: outcome.status,
      deleted: outcome.deleted,
      failures: outcome.failures,
      tables: outcome.tables,
      budgetExhausted: outcome.budgetExhausted,
    };
  }
}
