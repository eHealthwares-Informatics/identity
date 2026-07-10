import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/users.controller';
import { CreateUserUseCase } from './services/create-user.use-case';
import { UpdateUserUseCase } from './services/update-user.use-case';
import { DeleteUserUseCase } from './services/delete-user.use-case';
import { ListUsersUseCase } from './services/list-users.use-case';
import { AssignRoleUseCase } from './services/assign-role.use-case';
import { UserOrmEntity } from './entities/user.orm-entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity]), AuthModule],
  controllers: [UsersController],
  providers: [
    CreateUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ListUsersUseCase,
    AssignRoleUseCase,
  ],
})
export class UsersModule {}
