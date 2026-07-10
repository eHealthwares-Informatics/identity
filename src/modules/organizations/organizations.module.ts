import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsController } from './controllers/organizations.controller';
import { OrganizationOrmEntity } from './entities/organization.orm-entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationOrmEntity]), AuthModule],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
