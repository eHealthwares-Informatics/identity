import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvisionController } from './controllers/provision.controller';
import { ProvisionService } from './services/provision.service';
import { ProvisioningJobService } from './services/provisioning-job.service';
import { ProvisioningJobOrmEntity } from './entities/provisioning-job.orm-entity';
import { ScryptPasswordHasherService } from '../auth/services/scrypt-password-hasher.service';
import { PASSWORD_HASHER } from '../auth/services/identity.di-tokens';
import { OrganizationOrmEntity } from '../organizations/entities/organization.orm-entity';
import { LocationOrmEntity } from '../locations/entities/location.orm-entity';
import { RoleOrmEntity } from '../roles/entities/role.orm-entity';
import { PermissionOrmEntity } from '../roles/entities/permission.orm-entity';
import { UserOrmEntity } from '../users/entities/user.orm-entity';

// Runtime onboarding: provisions a complete, isolated tenant (identity +
// rxsoft backend + emr reference data). Registered synchronously through
// ProvisionService; `ProvisioningJobService` runs the same staged provisioner
// as a durable background job (202 + poll) for production onboarding.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationOrmEntity,
      LocationOrmEntity,
      RoleOrmEntity,
      PermissionOrmEntity,
      UserOrmEntity,
      ProvisioningJobOrmEntity,
    ]),
  ],
  controllers: [ProvisionController],
  providers: [
    ProvisionService,
    ProvisioningJobService,
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasherService },
  ],
  exports: [ProvisionService, ProvisioningJobService],
})
export class ProvisionModule {}
