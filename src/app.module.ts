import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm/dist/interfaces/typeorm-options.interface';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { RoleRequestsModule } from './modules/role-requests/role-requests.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ProvisionModule } from './modules/provision/provision.module';

// Named connections used by the provisioner to reach the rxsoft backend and
// emr databases (same PostgreSQL instance as identity in dev). Mandatory:
// provisioning fails fast at boot when either is unreachable. Raw SQL only —
// no entities are mapped on these connections.
const provisionedConnection = (envPrefix: string, defaultDb: string) =>
  TypeOrmModule.forRootAsync({
    name: envPrefix.toLowerCase(),
    inject: [ConfigService],
    useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
      type: 'postgres',
      host: config.get<string>(`${envPrefix}_DB_HOST`, 'localhost'),
      port: Number(config.get<string>(`${envPrefix}_DB_PORT`, '5432')),
      username: config.get<string>(`${envPrefix}_DB_USER`, 'postgres'),
      password: config.get<string>(`${envPrefix}_DB_PASSWORD`, 'postgres'),
      database: config.get<string>(`${envPrefix}_DB_NAME`, defaultDb),
      entities: [],
      synchronize: false,
      logging: config.get<string>('TYPEORM_LOGGING', 'false') === 'true',
    }),
  });

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
    provisionedConnection('BACKEND', 'rxsoft'),
    provisionedConnection('EMR', 'emr'),
    AuthModule,
    UsersModule,
    RolesModule,
    RoleRequestsModule,
    OrganizationsModule,
    LocationsModule,
    ProvisionModule,
  ],
})
export class AppModule {}
