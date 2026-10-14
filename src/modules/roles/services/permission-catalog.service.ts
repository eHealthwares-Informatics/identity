import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { permissionMatches } from '../../../common/utils/permission-matcher';
import { PermissionOrmEntity } from '../entities/permission.orm-entity';
import { MODULE_PERMISSIONS } from './permission-definitions.data';

/** Every concrete code in the static catalog (flattened across modules). */
export function catalogCodes(): string[] {
  return MODULE_PERMISSIONS.flatMap((module) => module.permissions.map((p) => p.code));
}

/**
 * Expands a set of granted codes against the catalog.
 *
 * Role templates grant wildcards (`rxsoft.catalog.*`, `rxsoft.*`) and the
 * runtime matcher understands them, but role→permission links are *rows* in the
 * `role_permissions` junction, which can only reference a concrete permission —
 * a wildcard can never be stored. So a wildcard grant must be resolved to every
 * concrete catalog code it covers, using the same positional semantics as the
 * runtime matcher (`permissionMatches`), before the links are written.
 *
 * Concrete codes pass through unchanged, so genuinely-unknown codes still
 * surface as "unknown permission" downstream rather than being silently
 * swallowed here.
 */
export function expandPermissionCodes(granted: string[], catalog: string[]): string[] {
  const expanded = new Set<string>();

  for (const code of granted) {
    if (!code.includes('*')) {
      expanded.add(code);
      continue;
    }
    for (const candidate of catalog) {
      if (permissionMatches(code, candidate)) {
        expanded.add(candidate);
      }
    }
  }

  return [...expanded];
}

export type CatalogSyncResult = {
  /** Codes that were not rows before and have been inserted. */
  inserted: number;
  /** Existing rows whose resource/action/description drifted and were fixed. */
  updated: number;
  /** Total concrete codes in the catalog. */
  total: number;
};

/**
 * Owns the identity permission catalog.
 *
 * The static `MODULE_PERMISSIONS` list is the source of truth; the `permissions`
 * TABLE is what every consumer actually reads (the provisioner resolves role
 * grants against it, and role editing links to its rows). Historically nothing
 * ever wrote the table, so it stayed empty/stale and the provisioner skipped
 * every grant — leaving seeded restricted roles with zero permissions
 * (rxsoft-qa#798). `syncCatalog()` closes that gap idempotently.
 */
@Injectable()
export class PermissionCatalogService {
  private readonly logger = new Logger(PermissionCatalogService.name);

  constructor(
    @Optional()
    @InjectRepository(PermissionOrmEntity)
    private readonly permissionRepository?: Repository<PermissionOrmEntity>,
  ) {}

  /** Concrete catalog codes (wildcards expanded), for grant resolution. */
  codes(): string[] {
    return catalogCodes();
  }

  /** Expands wildcard grants to concrete catalog codes. */
  expand(granted: string[]): string[] {
    return expandPermissionCodes(granted, catalogCodes());
  }

  /**
   * Idempotently upserts the static catalog into the `permissions` table:
   * inserts codes that are missing, refreshes drifted metadata, and leaves
   * everything else untouched. Safe to run repeatedly.
   */
  async syncCatalog(): Promise<CatalogSyncResult> {
    if (!this.permissionRepository) {
      throw new Error('permission repository is not available');
    }

    const definitions = MODULE_PERMISSIONS.flatMap((module) =>
      module.permissions.map((permission) => ({ ...permission }))
    );

    const existing = await this.permissionRepository.find();
    const byCode = new Map(existing.map((row) => [row.code, row]));

    const toInsert: PermissionOrmEntity[] = [];
    const toUpdate: PermissionOrmEntity[] = [];

    for (const definition of definitions) {
      const row = byCode.get(definition.code);

      if (!row) {
        toInsert.push(
          this.permissionRepository.create({
            code: definition.code,
            resource: definition.resource,
            action: definition.action,
            description: definition.description,
          })
        );
        continue;
      }

      if (
        row.resource !== definition.resource ||
        row.action !== definition.action ||
        row.description !== definition.description
      ) {
        row.resource = definition.resource;
        row.action = definition.action;
        row.description = definition.description;
        toUpdate.push(row);
      }
    }

    if (toInsert.length) {
      await this.permissionRepository.save(toInsert);
    }
    if (toUpdate.length) {
      await this.permissionRepository.save(toUpdate);
    }

    return { inserted: toInsert.length, updated: toUpdate.length, total: definitions.length };
  }

  /**
   * Boot-time convenience wrapper. NEVER throws: a boot must not fail because
   * the database is unreachable or the catalog is mid-deploy. Callers that need
   * to know the outcome (the seed CLI) should use `syncCatalog()` directly.
   */
  async syncCatalogOnBoot(): Promise<void> {
    if (process.env.SEED_PERMISSIONS_ON_BOOT === 'false') {
      this.logger.log('permission catalog sync disabled (SEED_PERMISSIONS_ON_BOOT=false)');
      return;
    }

    try {
      const result = await this.syncCatalog();
      this.logger.log(
        `permission catalog synced: +${result.inserted} new, ${result.updated} updated (${result.total} total)`
      );
    } catch (error) {
      this.logger.warn(
        `permission catalog sync skipped (boot continues): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * Wires the catalog sync into boot. Deliberately thin: all failure handling
 * lives in `syncCatalogOnBoot`, so a cold database (or a mid-deploy catalog)
 * can never stop identity from starting.
 */
@Injectable()
export class PermissionCatalogBootstrap implements OnModuleInit {
  constructor(private readonly catalog: PermissionCatalogService) {}

  async onModuleInit(): Promise<void> {
    await this.catalog.syncCatalogOnBoot();
  }
}
