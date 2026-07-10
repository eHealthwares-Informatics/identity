import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from './controllers/roles.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { CreateRoleUseCase } from './services/create-role.use-case';
import { ListRolesUseCase } from './services/list-roles.use-case';
import { GetRoleUseCase } from './services/get-role.use-case';
import { UpdateRoleUseCase } from './services/update-role.use-case';
import { DeleteRoleUseCase } from './services/delete-role.use-case';
import { RoleOrmEntity } from './entities/role.orm-entity';
import { PermissionOrmEntity } from './entities/permission.orm-entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([RoleOrmEntity, PermissionOrmEntity]), AuthModule],
  controllers: [RolesController, PermissionsController],
  providers: [
    CreateRoleUseCase,
    ListRolesUseCase,
    GetRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
  ],
})
export class RolesModule {}
