import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AssignRoleUseCase } from '../users/services/assign-role.use-case';
import { RoleRequestsController } from './controllers/role-requests.controller';
import { RoleRequestOrmEntity } from './entities/role-request.orm-entity';
import { RoleRequestService } from './services/role-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoleRequestOrmEntity]), AuthModule],
  controllers: [RoleRequestsController],
  providers: [RoleRequestService, AssignRoleUseCase],
})
export class RoleRequestsModule {}