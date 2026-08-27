import { Inject } from '@nestjs/common';
import { BadGatewayException, ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationOrmEntity } from '../../organizations/entities/organization.orm-entity';
import { OnboardOrganisationDto } from '../dto/onboard-organisation.dto';
import { USER_REPOSITORY } from './identity.di-tokens';
import type { UserRepository } from '../../users/repositories/user.repository';

// Public self-serve onboarding facade. Creates a brand-new organisation by
// delegating to the seed service's provisioning module (POST /api/provision,
// service-to-service with x-api-key — the client never sees the seed key).
// This is a thin entrypoint: identity validates + gates; seed builds the full
// tenant (roles, users, permissions, item whitelist, price list, stock,
// parties, POS configs) in both the identity and backend databases.
@Injectable()
export class OnboardOrganisationService {
  private readonly logger = new Logger(OnboardOrganisationService.name);

  constructor(
    @InjectRepository(OrganizationOrmEntity)
    private readonly organizationRepository: Repository<OrganizationOrmEntity>,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly config: ConfigService,
  ) {}

  async execute(payload: OnboardOrganisationDto) {
    const enabled = this.config.get<string>('ONBOARD_ORGANISATIONS_ENABLED', 'true') === 'true';
    if (!enabled) {
      throw new ServiceUnavailableException('Organisation onboarding is not enabled');
    }

    const code = payload.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const existing = await this.organizationRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`An organisation with code "${code}" already exists`);
    }

    const ownerEmail = payload.ownerEmail.trim().toLowerCase();
    const emailOwner = await this.userRepository.findByEmail(ownerEmail);
    if (emailOwner) {
      throw new ConflictException(
        `Account with email "${ownerEmail}" already exists. Please sign in with that email.`,
      );
    }

    const seedUrl = this.config
      .get<string>('SEED_PROVISION_URL', 'http://localhost:8093')
      .replace(/\/$/, '');
    const seedApiKey = this.config.get<string>('SEED_PROVISION_API_KEY', '');

    let res: Response;
    try {
      res = await fetch(`${seedUrl}/api/provision`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(seedApiKey ? { 'x-api-key': seedApiKey } : {}),
        },
        body: JSON.stringify({
          code,
          name: payload.name,
          password: payload.password,
          ownerEmail,
          ownerUsername: payload.ownerUsername,
        }),
      });
    } catch (err: any) {
      this.logger.error(`provisioning unreachable: ${err.message}`);
      throw new ServiceUnavailableException('Provisioning service is unreachable');
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.error(`provisioning failed (${res.status}): ${JSON.stringify(body)}`);
      throw new BadGatewayException(
        body?.message ?? 'Organisation could not be provisioned',
      );
    }

    return body.organisation;
  }
}