import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PermissionCatalogService } from './modules/roles/services/permission-catalog.service';

/**
 * Explicit permission-catalog seed (rxsoft-qa#798).
 *
 * The `permissions` table is what every consumer reads — the provisioner
 * resolves role grants against it and role editing links to its rows — but the
 * static catalog in `permission-definitions.data.ts` is the source of truth.
 * Nothing used to write one from the other, so the table stayed empty and the
 * provisioner skipped every grant.
 *
 * Run after a deploy (or any time the catalog changes):
 *
 *   npm run seed:permissions          # node dist/seed-permissions.js
 *
 * Idempotent: inserts missing codes, refreshes drifted metadata, touches
 * nothing else. Unlike the boot-time sync this FAILS LOUDLY — an operator ran
 * it on purpose, so a missing database should be an error, not a warning.
 */
async function main(): Promise<void> {
  const logger = new Logger('seed:permissions');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const result = await app.get(PermissionCatalogService).syncCatalog();
    logger.log(
      `permission catalog: ${result.inserted} inserted, ${result.updated} updated, ${result.total} total`
    );
  } finally {
    // The seed has already committed at this point; a failure in the shutdown
    // hooks (TypeORM's named-datasource teardown can throw) must not turn a
    // successful seed into a non-zero exit.
    await app.close().catch((error: unknown) => {
      logger.warn(
        `shutdown hook failed (ignored): ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }
}

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[seed:permissions] failed:', error);
  process.exit(1);
});
