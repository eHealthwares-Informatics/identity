import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { seedIdentity } from './seeds/seed-identity';

@Injectable()
export class DatabaseSeedService {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async runSeedsOnStartup() {
    const shouldSeed = this.configService.get<string>('SEED_ON_START', 'true') === 'true';
    if (!shouldSeed) return;

    try {
      this.logger.log('Seeding database...');
      await seedIdentity(this.dataSource);
      this.logger.log('Seeding complete');
    } catch (error) {
      this.logger.error('Seeding failed:', error);
    }
  }
}
