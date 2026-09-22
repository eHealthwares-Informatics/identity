import { Inject } from '@nestjs/common';
import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationOrmEntity } from '../../organizations/entities/organization.orm-entity';
import { OnboardOrganisationDto } from '../dto/onboard-organisation.dto';
import { USER_REPOSITORY } from './identity.di-tokens';
import type { UserRepository } from '../../users/repositories/user.repository';
import { ProvisionService } from '../../provision/services/provision.service';

// Public self-serve onboarding facade ("Onboard your Organisation" on the
// login page). Creates a brand-new organisation by delegating to the native
// provisioner, which builds the full tenant (roles, users, permissions,
// item whitelist, price list, stock, parties, POS configs) in the identity,
// rxsoft backend and emr databases. Unlike the raw POST /provision endpoint,
// onboarding refuses to reuse an existing org code (409) instead of being
// idempotent, so sign-up never silently merges into another tenant.
@Injectable()
export class OnboardOrganisationService {
  private readonly logger = new Logger(OnboardOrganisationService.name);

  constructor(
    @InjectRepository(OrganizationOrmEntity)
    private readonly organizationRepository: Repository<OrganizationOrmEntity>,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly provisionService: ProvisionService,
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

    this.logger.log(`Onboarding organisation ${code} (owner ${ownerEmail})`);
    return this.provisionService.provision({
      code,
      name: payload.name,
      password: payload.password,
      ownerEmail,
      ownerUsername: payload.ownerUsername,
    });
  }
}
