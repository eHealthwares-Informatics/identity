import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsController } from './controllers/organizations.controller';
import { OrganizationOrmEntity } from './entities/organization.orm-entity';
import { TypeormOrganizationRepository } from './repositories/typeorm-organization.repository';
import { ListOrganizationsUseCase } from './services/list-organizations.use-case';
import { GetOrganizationUseCase } from './services/get-organization.use-case';
import { CreateOrganizationUseCase } from './services/create-organization.use-case';
import { UpdateOrganizationUseCase } from './services/update-organization.use-case';
import { DeleteOrganizationUseCase } from './services/delete-organization.use-case';
import { ORG_REPOSITORY } from '../auth/services/identity.di-tokens';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationOrmEntity]), AuthModule],
  controllers: [OrganizationsController],
  providers: [
    TypeormOrganizationRepository,
    ListOrganizationsUseCase,
    GetOrganizationUseCase,
    CreateOrganizationUseCase,
    UpdateOrganizationUseCase,
    DeleteOrganizationUseCase,
    { provide: ORG_REPOSITORY, useExisting: TypeormOrganizationRepository },
  ],
  exports: [ORG_REPOSITORY],
})
export class OrganizationsModule {}