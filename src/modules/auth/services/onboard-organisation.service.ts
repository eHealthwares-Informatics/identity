import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnboardOrganisationDto } from '../dto/onboard-organisation.dto';
import { ProvisioningJobService } from '../../provision/services/provisioning-job.service';

// Public self-serve onboarding facade ("Onboard your Organisation" on the
// login page). Creates a brand-new organisation by queueing identity's native
// provisioner, which builds the full tenant (roles, users, permissions, item
// whitelist, price list, stock, parties, POS configs, EMR clinical data) in the
// identity, rxsoft backend and emr databases.
//
// The request returns 202 immediately; the client polls
// GET /provision/status/:code while the background worker runs. The job state
// is durable, so a restart resumes from the last completed stage/batch instead
// of stranding a half-provisioned tenant.
@Injectable()
export class OnboardOrganisationService {
  private readonly logger = new Logger(OnboardOrganisationService.name);

  constructor(
    private readonly provisioningJobs: ProvisioningJobService,
    private readonly config: ConfigService,
  ) {}

  async execute(payload: OnboardOrganisationDto) {
    const enabled = this.config.get<string>('ONBOARD_ORGANISATIONS_ENABLED', 'true') === 'true';
    if (!enabled) {
      throw new ServiceUnavailableException('Organisation onboarding is not enabled');
    }

    this.logger.log(
      `Queueing onboarding for ${payload.code.toUpperCase()} (owner ${payload.ownerEmail})`,
    );
    return this.provisioningJobs.createOrGet(payload);
  }

  /** Current provisioning state for an organisation (sidebar marker). */
  statusForOrganization(organizationId: string | null | undefined) {
    return this.provisioningJobs.statusForOrganization(organizationId);
  }
}
