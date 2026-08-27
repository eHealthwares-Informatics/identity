import { Module } from '@nestjs/common';
import { LocationsController } from './controllers/locations.controller';
import { ListLocationsUseCase } from './services/list-locations.use-case';
import { GetLocationUseCase } from './services/get-location.use-case';
import { CreateLocationUseCase } from './services/create-location.use-case';
import { UpdateLocationUseCase } from './services/update-location.use-case';
import { DeleteLocationUseCase } from './services/delete-location.use-case';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LocationsController],
  providers: [
    ListLocationsUseCase,
    GetLocationUseCase,
    CreateLocationUseCase,
    UpdateLocationUseCase,
    DeleteLocationUseCase,
  ],
})
export class LocationsModule {}
