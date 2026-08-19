import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm/dist/interfaces/typeorm-options.interface';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { LocationsModule } from './modules/locations/locations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const type = config.get<'postgres' | 'sqlite'>('DB_TYPE', 'postgres');
        return {
          type,
          host: type === 'postgres' ? config.get<string>('DB_HOST', 'localhost') : undefined,
          port: type === 'postgres' ? Number(config.get<string>('DB_PORT', '5432')) : undefined,
          username: type === 'postgres' ? config.get<string>('DB_USER', 'postgres') : undefined,
          password: type === 'postgres' ? config.get<string>('DB_PASSWORD', 'postgres') : undefined,
          database: config.get<string>('DB_NAME', 'identity'),
          autoLoadEntities: true,
          synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
          dropSchema: config.get<string>('DB_DROP_SCHEMA', 'false') === 'true',
          logging: config.get<string>('TYPEORM_LOGGING', 'false') === 'true',
        } as TypeOrmModuleOptions;
      },
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    OrganizationsModule,
    LocationsModule,
  ],
})
export class AppModule {}
