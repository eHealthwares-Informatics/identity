import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './controllers/auth.controller';
import { LoginUseCase } from './services/login.use-case';
import { RefreshTokenUseCase } from './services/refresh-token.use-case';
import { RegisterUseCase } from './services/register.use-case';
import { JwtTokenIssuerService } from './services/jwt-token-issuer.service';
import { Sha256PasswordHasherService } from './services/sha256-password-hasher.service';
import { TypeormRefreshTokenRepository } from './repositories/typeorm-refresh-token.repository';
import { TypeormUserRepository } from '../users/repositories/typeorm-user.repository';
import { TypeormRoleRepository } from '../roles/repositories/typeorm-role.repository';
import { RefreshTokenOrmEntity } from './entities/refresh-token.orm-entity';
import { UserOrmEntity } from '../users/entities/user.orm-entity';
import { RoleOrmEntity } from '../roles/entities/role.orm-entity';
import { PermissionOrmEntity } from '../roles/entities/permission.orm-entity';
import {
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  ROLE_REPOSITORY,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from './services/identity.di-tokens';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([RefreshTokenOrmEntity, UserOrmEntity, RoleOrmEntity, PermissionOrmEntity]),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    RefreshTokenUseCase,
    RegisterUseCase,
    JwtAuthGuard,
    RolesGuard,
    TypeormUserRepository,
    TypeormRoleRepository,
    TypeormRefreshTokenRepository,
    { provide: USER_REPOSITORY, useExisting: TypeormUserRepository },
    { provide: ROLE_REPOSITORY, useExisting: TypeormRoleRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useExisting: TypeormRefreshTokenRepository },
    { provide: PASSWORD_HASHER, useClass: Sha256PasswordHasherService },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuerService },
  ],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, USER_REPOSITORY, ROLE_REPOSITORY, TOKEN_ISSUER, PASSWORD_HASHER],
})
export class AuthModule {}
