import { Module } from '@nestjs/common';
import { LocationsController } from './controllers/locations.controller';
import { ListLocationsUseCase } from './services/list-locations.use-case';
import { GetLocationUseCase } from './services/get-location.use-case';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LocationsController],
  providers: [ListLocationsUseCase, GetLocationUseCase],
})
export class LocationsModule {}
