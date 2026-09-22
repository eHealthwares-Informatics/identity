import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProvisionController } from './controllers/provision.controller';
import { ProvisionService } from './services/provision.service';
import { Sha256PasswordHasherService } from '../auth/services/sha256-password-hasher.service';
import { PASSWORD_HASHER } from '../auth/services/identity.di-tokens';
import { OrganizationOrmEntity } from '../organizations/entities/organization.orm-entity';
import { LocationOrmEntity } from '../locations/entities/location.orm-entity';
import { RoleOrmEntity } from '../roles/entities/role.orm-entity';
import { PermissionOrmEntity } from '../roles/entities/permission.orm-entity';
import { UserOrmEntity } from '../users/entities/user.orm-entity';

// Runtime onboarding: provisions a complete, isolated tenant (identity +
// rxsoft backend + emr reference data) in one call. The backend and emr
// databases are opened as named TypeORM connections in app.module.ts
// (BACKEND_DB_* / EMR_DB_* envs); this module only needs the repositories for
// the identity side plus the named DataSources.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationOrmEntity,
      LocationOrmEntity,
      RoleOrmEntity,
      PermissionOrmEntity,
      UserOrmEntity,
    ]),
  ],
  controllers: [ProvisionController],
  providers: [
    ProvisionService,
    { provide: PASSWORD_HASHER, useClass: Sha256PasswordHasherService },
  ],
  exports: [ProvisionService],
})
export class ProvisionModule {}
