import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsController } from './controllers/locations.controller';
import { LocationOrmEntity } from './entities/location.orm-entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([LocationOrmEntity]), AuthModule],
  controllers: [LocationsController],
})
export class LocationsModule {}
