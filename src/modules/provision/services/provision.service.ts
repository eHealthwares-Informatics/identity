import { Inject, Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource, Repository } from 'typeorm';
import { OrganizationOrmEntity } from '../../organizations/entities/organization.orm-entity';
import { LocationOrmEntity } from '../../locations/entities/location.orm-entity';
import { RoleOrmEntity } from '../../roles/entities/role.orm-entity';
import { PermissionOrmEntity } from '../../roles/entities/permission.orm-entity';
import { UserOrmEntity } from '../../users/entities/user.orm-entity';
import {
  DEFAULT_ORG_DEPARTMENTS,
  DEFAULT_ORG_WARDS,
  BEDS_PER_WARD,
  DEMO_BED_STATUSES,
  DEMO_ORG_PATIENTS,
  DEMO_ORG_ADMISSIONS,
  DEFAULT_ORGANIZATION_ID,
  LOCATION_HQ_CODE,
  LOCATION_HQ_NAME,
  LOCATION_STORE_SUFFIX,
  ORG_TEMPLATE_ROLES,
  ORG_TEMPLATE_USERS,
  RETAIL_PRICE_LIST_CODE,
} from '../org-template';
import { ProvisionOrganisationDto } from '../dto/provision-organisation.dto';
import type {
  LocationRef,
  PriceListRef,
  ProvisionContext,
  StageProgress,
} from '../provision-context';
import {
  PROVISION_STAGE_NAMES,
  type ProvisionStageName,
} from '../provision-job.types';
import {
  DeprovisionOutcome,
  ProvisionResult,
  ProvisionedUser,
  ProvisionStatus,
} from '../provision-result';
import { RawUpsertTarget } from './raw-upsert.target';
import {
  CleanupResult,
  CleanupStep,
  DeprovisionCleaner,
  cleanupOptionsFromEnv,
} from './deprovision-cleanup';
import { PASSWORD_HASHER } from '../../auth/services/identity.di-tokens';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';

// Provisions a complete, isolated tenant (organisation) across the identity,
// rxsoft backend and emr databases. Everything is written via upserts keyed on
// stable conflict keys so re-running on the same code is idempotent: rows are
// reused, not duplicated. Owns ALL sides of onboarding:
//   identity — organization, locations (HQ + store), org-scoped roles,
//              role_permissions, users, user_roles
//   backend  — organisation_items whitelist, organisation_payment_providers,
//              organisation_configs, retail price list + items, warehouses,
//              stock locations, store_stock_locations (sale_issue /
//              sale_return), stock lots, opening stock balances, minimal
//              parties, user_pos_configs
//   emr      — default departments at the HQ site
@Injectable()
export class ProvisionService {
  private readonly logger = new Logger(ProvisionService.name);

  constructor(
    @InjectRepository(OrganizationOrmEntity)
    private readonly organizationRepository: Repository<OrganizationOrmEntity>,
    @InjectRepository(LocationOrmEntity)
    private readonly locationRepository: Repository<LocationOrmEntity>,
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepository: Repository<RoleOrmEntity>,
    @InjectRepository(PermissionOrmEntity)
    private readonly permissionRepository: Repository<PermissionOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @InjectDataSource('backend')
    private readonly backendDb: DataSource,
    @InjectDataSource('emr')
    private readonly emrDb: DataSource,
    private readonly config: ConfigService,
  ) {}

  // ── Staged provisioning ────────────────────────────────────────────────
  // `provision()` remains a synchronous convenience (tests/scripts). Runtime
  // onboarding runs the same stages through ProvisioningJobService; each stage
  // is idempotent and the catalogue stages checkpoint a cursor after every
  // batch, so a restart resumes instead of stranding a half-built tenant.

  async runProvisionStage(
    stage: ProvisionStageName,
    ctx: ProvisionContext,
    cursor: string | null,
    onProgress: StageProgress,
  ): Promise<void> {
    switch (stage) {
      case 'identity':
        return this.stageIdentity(ctx);
      case 'emr':
        return this.stageEmr(ctx);
      case 'identity-access':
        return this.stageIdentityAccess(ctx);
      case 'backend-items':
        return this.stageBackendItems(ctx, cursor, onProgress);
      case 'backend-config':
        return this.stageBackendConfig(ctx);
      case 'backend-pricelist':
        return this.stageBackendPriceList(ctx, cursor, onProgress);
      case 'backend-stock-locations':
        return this.stageBackendStockLocations(ctx);
      case 'backend-lots':
        return this.stageBackendLots(ctx, cursor, onProgress);
      case 'backend-balances':
        return this.stageBackendBalances(ctx, cursor, onProgress);
      case 'backend-parties':
        return this.stageBackendParties(ctx);
      case 'backend-pos':
        return this.stageBackendPos(ctx);
      default: {
        const exhaustive: never = stage;
        throw new Error(`Unknown provisioning stage: ${String(exhaustive)}`);
      }
    }
  }

  async provision(dto: ProvisionOrganisationDto): Promise<ProvisionResult> {
    const ctx = await this.buildSyncContext(dto);
    for (const stage of PROVISION_STAGE_NAMES) {
      await this.runProvisionStage(stage, ctx, null, () => undefined);
    }
    return this.buildResult(ctx);
  }

  private async buildSyncContext(dto: ProvisionOrganisationDto): Promise<ProvisionContext> {
    const orgCode = dto.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const orgName = dto.name.trim();
    if (!orgCode || !orgName) {
      throw new BadRequestException('code and name are required');
    }
    const password = dto.password ?? 'password';
    return {
      orgId: randomUUID(),
      orgCode,
      orgName,
      storeCode: (dto.storeCode ?? LOCATION_STORE_SUFFIX).toUpperCase(),
      ownerEmail: dto.ownerEmail?.trim().toLowerCase() ?? null,
      ownerUsername: dto.ownerUsername ?? null,
      useSubset: Boolean(dto.items?.length) && dto.whitelistItems !== 'all',
      items: dto.items ?? null,
      passwordHash: await this.passwordHasher.hash(password),
      plainPassword: password,
      created: false,
    };
  }

  private provisionBatchSize(): number {
    const raw = Number(this.config.get<string>('PROVISION_BATCH_SIZE', '1000'));
    return Number.isFinite(raw) && raw >= 100 ? Math.min(Math.floor(raw), 5000) : 1000;
  }

  // ── identity ───────────────────────────────────────────────────────────
  private async stageIdentity(ctx: ProvisionContext): Promise<void> {
    const existing = await this.organizationRepository.findOne({
      where: { code: ctx.orgCode },
      withDeleted: true,
    });
    if (existing) {
      ctx.orgId = existing.id;
    } else {
      ctx.created = true;
    }
    await this.organizationRepository.save({
      id: ctx.orgId,
      code: ctx.orgCode,
      name: ctx.orgName,
      isActive: true,
      domain: existing?.domain ?? null,
      deletedAt: null,
    });
    await this.ensureLocations(ctx, true);
    this.logger.log(`[${ctx.orgCode}] identity: organisation + locations ready`);
  }

  private async ensureLocations(ctx: ProvisionContext, create = false): Promise<void> {
    if (ctx.hq && ctx.store) {
      return;
    }
    const locations = await this.locationRepository.find({
      where: { organizationId: ctx.orgId },
      withDeleted: true,
    });
    const byCode = new Map(locations.map((location) => [location.code, location]));
    let hq = byCode.get(LOCATION_HQ_CODE);
    let store = byCode.get(ctx.storeCode);
    if (create) {
      hq =
        hq ??
        ({
          id: randomUUID(),
          organizationId: ctx.orgId,
          code: LOCATION_HQ_CODE,
          name: `${ctx.orgName} ${LOCATION_HQ_NAME}`,
          parentId: null,
          isActive: true,
        } as LocationOrmEntity);
      store =
        store ??
        ({
          id: randomUUID(),
          organizationId: ctx.orgId,
          code: ctx.storeCode,
          name: `${ctx.orgName} Store`,
          parentId: null,
          isActive: true,
        } as LocationOrmEntity);
      store.parentId = store.parentId ?? hq.id;
      await this.locationRepository.save([hq, store]);
    }
    if (!hq || !store) {
      throw new Error(`Locations missing for ${ctx.orgCode}`);
    }
    ctx.hq = { id: hq.id, code: hq.code, name: hq.name };
    ctx.store = { id: store.id, code: store.code, name: store.name };
  }

  // ── emr ────────────────────────────────────────────────────────────────
  private async stageEmr(ctx: ProvisionContext): Promise<void> {
    await this.ensureLocations(ctx);
    const hq = ctx.hq!;
    const orgId = ctx.orgId;
    const orgCode = ctx.orgCode;

    const deptTarget = new RawUpsertTarget(this.emrDb, 'departments', ['id'], orgId);
    const existingDepts = await deptTarget.findAll();
    const deptByCode = new Map(existingDepts.map((d) => [d.code, d]));
    const departmentRows = DEFAULT_ORG_DEPARTMENTS.map((tpl) => ({
      id: deptByCode.get(tpl.code)?.id ?? randomUUID(),
      organization_id: orgId,
      location_id: hq.id,
      code: tpl.code,
      name: tpl.name,
      department_type: tpl.type,
      description: tpl.description,
      is_active: true,
    }));
    await deptTarget.save(departmentRows);
    for (const row of departmentRows) deptByCode.set(String(row.code), row);
    this.logger.log(`[${orgCode}] emr: ${departmentRows.length} departments`);

    const wardTarget = new RawUpsertTarget(this.emrDb, 'wards', ['id'], orgId);
    const existingWards = await wardTarget.findAll();
    const wardByCode = new Map(existingWards.map((w) => [w.code as string, w]));
    const wardRows = DEFAULT_ORG_WARDS.flatMap((tpl) => {
      const department = deptByCode.get(tpl.departmentCode);
      if (!department) return [];
      const existing = wardByCode.get(tpl.code);
      return [
        {
          id: existing?.id ?? randomUUID(),
          organization_id: orgId,
          location_id: hq.id,
          code: tpl.code,
          name: tpl.name,
          ward_type: tpl.type,
          department_id: String(department.id),
          department_type: String(department.department_type ?? ''),
          description: `${tpl.name} for ${String(department.name)}`,
          is_active: true,
        },
      ];
    });
    await wardTarget.save(wardRows);

    const bedTarget = new RawUpsertTarget(this.emrDb, 'beds', ['id'], orgId);
    const existingBeds = await bedTarget.findAll();
    const bedByCode = new Map(existingBeds.map((b) => [b.code as string, b]));
    const bedRows = wardRows.flatMap((ward) =>
      Array.from({ length: BEDS_PER_WARD }, (_, i) => {
        const code = `${ward.code as string}-${String(i + 1).padStart(2, '0')}`;
        const existing = bedByCode.get(code);
        return {
          id: existing?.id ?? randomUUID(),
          organization_id: orgId,
          location_id: hq.id,
          ward_id: ward.id,
          code,
          bed_type: 'STANDARD',
          status: DEMO_BED_STATUSES[code] ?? 'AVAILABLE',
          notes: null,
        };
      }),
    );
    await bedTarget.save(bedRows);
    this.logger.log(`[${orgCode}] emr: ${wardRows.length} wards / ${bedRows.length} beds`);

    const mrn = (base: string) => `${base}-${orgCode}`;
    const patientTarget = new RawUpsertTarget(this.emrDb, 'patients', ['id'], orgId);
    const existingPatients = await patientTarget.findAll();
    const patientByMrn = new Map(existingPatients.map((p) => [p.patient_id as string, p]));
    const patientRows = DEMO_ORG_PATIENTS.map((tpl) => {
      const patientId = mrn(tpl.patientId);
      const existing = patientByMrn.get(patientId);
      return {
        id: existing?.id ?? randomUUID(),
        organization_id: orgId,
        location_id: hq.id,
        patient_id: patientId,
        first_name: tpl.firstName,
        last_name: tpl.lastName,
        gender: tpl.gender,
        date_of_birth: tpl.dateOfBirth,
        phone: tpl.phone,
        is_active: true,
      };
    });
    await patientTarget.save(patientRows);
    const mrnByBaseMrn = new Map(DEMO_ORG_PATIENTS.map((p) => [p.patientId, mrn(p.patientId)]));

    const visitTarget = new RawUpsertTarget(this.emrDb, 'visits', ['id'], orgId);
    const existingVisits = await visitTarget.findAll();
    const visitByNumber = new Map(existingVisits.map((v) => [v.visit_number as string, v]));
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const visitNumber = (index: number) =>
      `VIS-DEMO-${String(index + 1).padStart(3, '0')}-${orgCode}`;
    const patientNameByMrn = new Map(
      DEMO_ORG_PATIENTS.map((p) => [p.patientId, `${p.firstName} ${p.lastName}`]),
    );
    const visitRows = DEMO_ORG_ADMISSIONS.map((tpl, index) => {
      const visitNo = visitNumber(index);
      const existing = visitByNumber.get(visitNo);
      const admittedAt = new Date(now - tpl.admittedDaysAgo * DAY_MS).toISOString();
      const discharged = tpl.status === 'DISCHARGED';
      return {
        id: existing?.id ?? randomUUID(),
        organization_id: orgId,
        location_id: hq.id,
        visit_number: visitNo,
        patient_id: mrnByBaseMrn.get(tpl.patientMrn) ?? tpl.patientMrn,
        patient_name: patientNameByMrn.get(tpl.patientMrn) ?? tpl.patientMrn,
        visit_type: 'INPATIENT',
        status: discharged ? 'COMPLETED' : 'ONGOING',
        start_datetime: admittedAt,
        stop_datetime: discharged ? new Date(now - 2 * DAY_MS).toISOString() : null,
        provider_name: null,
        notes: null,
      };
    });
    await visitTarget.save(visitRows);
    const visitIdByNumber = new Map(visitRows.map((v) => [v.visit_number as string, v.id]));

    const admissionTarget = new RawUpsertTarget(this.emrDb, 'admissions', ['id'], orgId);
    const existingAdmissions = await admissionTarget.findAll();
    const admissionByNumber = new Map(
      existingAdmissions.map((a) => [a.admission_number as string, a]),
    );
    const wardIdByCode = new Map(wardRows.map((w) => [w.code as string, w.id]));
    const bedIdByCode = new Map(bedRows.map((b) => [b.code as string, b.id]));
    const admissionRows = DEMO_ORG_ADMISSIONS.map((tpl, index) => {
      const existing = admissionByNumber.get(tpl.admissionNumber);
      return {
        id: existing?.id ?? randomUUID(),
        organization_id: orgId,
        location_id: hq.id,
        admission_number: tpl.admissionNumber,
        patient_id: mrnByBaseMrn.get(tpl.patientMrn) ?? tpl.patientMrn,
        patient_name: patientNameByMrn.get(tpl.patientMrn) ?? tpl.patientMrn,
        ward_id: wardIdByCode.get(tpl.wardCode) ?? null,
        bed_id: bedIdByCode.get(tpl.bedCode) ?? null,
        admission_datetime: new Date(now - tpl.admittedDaysAgo * DAY_MS).toISOString(),
        admission_type: tpl.admissionType,
        diagnosis: tpl.diagnosis,
        status: tpl.status,
        discharge_datetime:
          tpl.status === 'DISCHARGED' ? new Date(now - 2 * DAY_MS).toISOString() : null,
        discharge_type: tpl.dischargeType ?? null,
        discharge_summary: tpl.dischargeSummary ?? null,
        visit_id: visitIdByNumber.get(visitNumber(index)) ?? null,
        notes: null,
      };
    });
    await admissionTarget.save(admissionRows);
    this.logger.log(
      `[${orgCode}] emr: ${visitRows.length} visits / ${patientRows.length} patients / ${admissionRows.length} admissions`,
    );
  }

  // ── identity: roles, grants, users ─────────────────────────────────────
  private async stageIdentityAccess(ctx: ProvisionContext): Promise<void> {
    await this.ensureLocations(ctx);
    const orgId = ctx.orgId;
    const orgCode = ctx.orgCode;
    const hq = ctx.hq!;
    const store = ctx.store!;

    const existingRoles = await this.roleRepository.find({
      where: { organizationId: orgId },
    });
    const roleIdByCode = new Map<string, string>();
    const roleRows = Object.entries(ORG_TEMPLATE_ROLES).map(([code, tpl]) => {
      const existing = existingRoles.find((r) => r.code === code);
      const id = existing?.id ?? randomUUID();
      roleIdByCode.set(code, id);
      return {
        id,
        organizationId: orgId,
        code,
        name: tpl.name,
        description: tpl.description,
      };
    });
    await this.roleRepository.save(roleRows);

    const permissions = await this.permissionRepository.find();
    const permIdByCode = new Map(permissions.map((p) => [p.code, p.id]));
    const rpRows: Array<[string, string]> = [];
    for (const [roleCode, tpl] of Object.entries(ORG_TEMPLATE_ROLES)) {
      const roleId = roleIdByCode.get(roleCode);
      if (!roleId) continue;
      for (const permCode of tpl.permissions) {
        const permissionId = permIdByCode.get(permCode);
        if (!permissionId) {
          this.logger.warn(
            `[${orgCode}] skipping unknown permission "${permCode}" for role "${roleCode}"`,
          );
          continue;
        }
        rpRows.push([roleId, permissionId]);
      }
    }
    if (rpRows.length) {
      await this.defaultDb().query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id")
         VALUES ${rpRows.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')}
         ON CONFLICT DO NOTHING`,
        rpRows.flat(),
      );
    }

    const allUsers = await this.userRepository.find({ withDeleted: true });
    const usersByOrgUsername = new Map(
      allUsers.map((u) => [`${u.organizationId}|${u.username}`, u]),
    );
    const ownerEmail = ctx.ownerEmail;
    if (ownerEmail) {
      const emailOwner = allUsers.find(
        (u) => String(u.email ?? '').toLowerCase() === ownerEmail && u.deletedAt == null,
      );
      if (emailOwner && emailOwner.organizationId !== orgId) {
        throw new ConflictException(`Account with email "${ownerEmail}" already exists`);
      }
    }
    const userRows: UserOrmEntity[] = [];
    const usernameBySuffix = new Map<string, string>();
    for (const tpl of ORG_TEMPLATE_USERS) {
      const isOwner = tpl.suffix === 'OWNER';
      const username = isOwner
        ? ownerEmail ?? ctx.ownerUsername ?? `${orgCode}_${tpl.suffix}`
        : `${orgCode}_${tpl.suffix}`;
      const sameOrgOwner =
        isOwner && ownerEmail
          ? allUsers.find(
              (u) =>
                String(u.email ?? '').toLowerCase() === ownerEmail &&
                u.organizationId === orgId &&
                u.deletedAt == null,
            )
          : undefined;
      const existing = sameOrgOwner ?? usersByOrgUsername.get(`${orgId}|${username}`);
      const loc = tpl.locationCode === ctx.storeCode ? store : hq;
      userRows.push({
        id: existing?.id ?? randomUUID(),
        organizationId: orgId,
        username,
        passwordHash: ctx.passwordHash,
        isActive: true,
        locationId: loc.id,
        email: isOwner ? ownerEmail ?? null : null,
        deletedAt: null,
      } as UserOrmEntity);
      usernameBySuffix.set(tpl.suffix, username);
    }
    await this.userRepository.save(userRows);
    const userIdByName = new Map(userRows.map((u) => [u.username, u.id]));

    const urRows: Array<[string, string]> = [];
    for (const tpl of ORG_TEMPLATE_USERS) {
      const userId = userIdByName.get(usernameBySuffix.get(tpl.suffix)!);
      if (!userId) continue;
      for (const roleCode of tpl.roles) {
        const roleId = roleIdByCode.get(roleCode);
        if (!roleId) continue;
        urRows.push([userId, roleId]);
      }
    }
    if (urRows.length) {
      await this.defaultDb().query(
        `INSERT INTO "user_roles" ("user_id", "role_id")
         VALUES ${urRows.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')}
         ON CONFLICT DO NOTHING`,
        urRows.flat(),
      );
    }

    ctx.userRows = userRows;
    ctx.provisionedUsers = userRows.map((u) => {
      const suffix = [...usernameBySuffix.entries()].find(
        ([, name]) => name === u.username,
      )?.[0];
      const roles = suffix
        ? (ORG_TEMPLATE_USERS.find((t) => t.suffix === suffix)?.roles ?? [])
        : [];
      return {
        username: u.username,
        password: ctx.plainPassword ?? '',
        roles,
        organizationId: orgId,
        locationId: u.locationId,
        email: u.email ?? null,
      };
    });
    this.logger.log(`[${orgCode}] identity: ${roleRows.length} roles / ${userRows.length} users`);
  }

  // ── backend: catalogue whitelist (chunked) ─────────────────────────────
  private async stageBackendItems(
    ctx: ProvisionContext,
    cursor: string | null,
    onProgress: StageProgress,
  ): Promise<void> {
    const batch = this.provisionBatchSize();
    const orgItemTarget = new RawUpsertTarget(
      this.backendDb,
      'organisation_items',
      ['organization_id', 'item_id'],
      ctx.orgId,
    );
    const selected = ctx.useSubset && ctx.items?.length ? new Set(ctx.items) : null;
    let last = cursor;

    for (;;) {
      const items = await this.pageItems(last, batch);
      if (!items.length) {
        await onProgress(null, 0);
        return;
      }
      const ids = items.map((item) => item.id);
      const overrides: Array<{ item_id: string; code: string | null }> =
        await this.backendDb.query(
          `SELECT item_id, code FROM organisation_items
           WHERE organization_id = $1 AND item_id = ANY($2::uuid[])`,
          [DEFAULT_ORGANIZATION_ID, ids],
        );
      const overrideByItem = new Map(overrides.map((row) => [row.item_id, row.code]));

      const rows: Record<string, any>[] = [];
      for (const item of items) {
        const code = this.resolveItemCode(item, overrideByItem.get(item.id));
        if (selected && !selected.has(code)) continue;
        rows.push({
          id: randomUUID(),
          organization_id: ctx.orgId,
          item_id: item.id,
          // Persist the resolved code (the old provisioner kept it in memory).
          // Later stages and resumes read it back without re-resolving.
          code,
          is_active: true,
          alias: null,
        });
      }
      if (rows.length) {
        await orgItemTarget.save(rows);
      }
      last = items[items.length - 1].id;
      await onProgress(last, rows.length);
    }
  }

  private resolveItemCode(
    item: { code?: string | null; name?: string | null },
    overrideCode?: string | null,
  ): string {
    if (item.code) return String(item.code);
    if (overrideCode) return String(overrideCode);
    return String(item.name ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_')
      .slice(0, 60);
  }

  private async pageItems(
    lastId: string | null,
    limit: number,
  ): Promise<Array<{ id: string; code: string | null; name: string | null }>> {
    return lastId
      ? this.backendDb.query(
          `SELECT id, code, name FROM items WHERE id > $1::uuid ORDER BY id LIMIT $2`,
          [lastId, limit],
        )
      : this.backendDb.query(
          `SELECT id, code, name FROM items ORDER BY id LIMIT $1`,
          [limit],
        );
  }

  private async pageOrgItems(
    orgId: string,
    lastItemId: string | null,
    limit: number,
  ): Promise<Array<{ item_id: string; code: string | null }>> {
    return this.backendDb.query(
      `SELECT oi.item_id,
              COALESCE(
                NULLIF(oi.code, ''),
                NULLIF(i.code, ''),
                LEFT(UPPER(REGEXP_REPLACE(i.name, '[^A-Za-z0-9_-]', '_', 'g')), 60)
              ) AS code
       FROM organisation_items oi
       LEFT JOIN items i ON i.id = oi.item_id
       WHERE oi.organization_id = $1
         AND ($2::uuid IS NULL OR oi.item_id > $2::uuid)
       ORDER BY oi.item_id
       LIMIT $3`,
      [orgId, lastItemId, limit],
    );
  }

  // ── backend: configuration ─────────────────────────────────────────────
  private async stageBackendConfig(ctx: ProvisionContext): Promise<void> {
    const providerTarget = new RawUpsertTarget(this.backendDb, 'payment_providers');
    const providers = await providerTarget.findAll();
    const orgProviderTarget = new RawUpsertTarget(
      this.backendDb,
      'organisation_payment_providers',
      ['organization_id', 'payment_provider_id'],
      ctx.orgId,
    );
    const existingOrgProviders = await orgProviderTarget.findAll();
    const existingOrgProviderByProvider = new Map(
      existingOrgProviders.map((o) => [o.payment_provider_id, o]),
    );
    const orgProviderRows = providers.map((provider) => ({
      id: existingOrgProviderByProvider.get(provider.id)?.id ?? randomUUID(),
      organization_id: ctx.orgId,
      payment_provider_id: provider.id,
      is_active: true,
      is_default: provider.channel === 'cash',
    }));
    if (orgProviderRows.length) {
      await orgProviderTarget.save(orgProviderRows);
    }

    const orgConfigTarget = new RawUpsertTarget(
      this.backendDb,
      'organisation_configs',
      ['organization_id'],
      ctx.orgId,
    );
    const existingOrgConfigs = await orgConfigTarget.findAll();
    await orgConfigTarget.save([
      {
        id: existingOrgConfigs[0]?.id ?? randomUUID(),
        organization_id: ctx.orgId,
        pos_header: null,
        default_login_timeout_minutes: 480,
        default_allow_pos: true,
        default_allow_a4_print: false,
      },
    ]);
  }

  // ── backend: price list (chunked) ──────────────────────────────────────
  private async ensurePriceList(ctx: ProvisionContext): Promise<PriceListRef> {
    if (ctx.priceList) return ctx.priceList;
    const target = new RawUpsertTarget(
      this.backendDb,
      'price_lists',
      ['organization_id', 'code'],
      ctx.orgId,
    );
    const existing = await target.findAll();
    const pl = existing.find((p) => p.code === RETAIL_PRICE_LIST_CODE) ?? { id: randomUUID() };
    await target.save([
      {
        id: pl.id,
        organization_id: ctx.orgId,
        code: RETAIL_PRICE_LIST_CODE,
        name: 'Retail Price List',
        is_default: true,
        is_active: true,
      },
    ]);
    ctx.priceList = {
      id: pl.id as string,
      code: RETAIL_PRICE_LIST_CODE,
      name: 'Retail Price List',
    };
    return ctx.priceList;
  }

  private async stageBackendPriceList(
    ctx: ProvisionContext,
    cursor: string | null,
    onProgress: StageProgress,
  ): Promise<void> {
    const pl = await this.ensurePriceList(ctx);
    const batch = this.provisionBatchSize();
    let last = cursor;

    for (;;) {
      const rows = await this.pageOrgItems(ctx.orgId, last, batch);
      if (!rows.length) {
        await onProgress(null, 0);
        return;
      }
      const pliRows = rows.map((row) => ({
        id: randomUUID(),
        price_list_id: pl.id,
        item_id: row.item_id,
        currency_code: 'NGN',
        unit_price: this.retailFor(row.code ?? ''),
      }));
      await this.insertIgnore(
        'price_list_items',
        ['id', 'price_list_id', 'item_id', 'currency_code', 'unit_price'],
        pliRows,
        ['price_list_id', 'item_id'],
      );
      last = rows[rows.length - 1].item_id;
      await onProgress(last, pliRows.length);
    }
  }

  // ── backend: warehouse + stock locations ───────────────────────────────
  private async stageBackendStockLocations(ctx: ProvisionContext): Promise<void> {
    await this.ensureLocations(ctx);
    const store = ctx.store!;
    const orgId = ctx.orgId;

    const whTarget = new RawUpsertTarget(this.backendDb, 'warehouses', ['id'], orgId);
    const existingWhs = await whTarget.findAll();
    const wh = existingWhs.find((w) => w.code === 'MAIN_WH') ?? { id: randomUUID() };
    await whTarget.save([
      {
        id: wh.id,
        organization_id: orgId,
        store_id: 'default',
        code: 'MAIN_WH',
        name: `${ctx.orgName} Main Warehouse`,
        is_active: true,
      },
    ]);
    ctx.warehouse = { id: wh.id as string, code: 'MAIN_WH', name: `${ctx.orgName} Main Warehouse` };

    const slTarget = new RawUpsertTarget(this.backendDb, 'stock_locations', ['id'], orgId);
    const existingSls = await slTarget.findAll();
    const slByCode = new Map(existingSls.map((s) => [s.code, s]));
    const makeLoc = (code: string, name: string, type: string) =>
      slByCode.get(code) ?? {
        id: randomUUID(),
        organization_id: orgId,
        location_id: store.id,
        warehouse_id: wh.id,
        code,
        name,
        location_type: type,
        is_active: true,
      };
    const saleLoc = makeLoc('SALE_STOCK', `${ctx.orgName} Sale Stock`, 'inventory');
    const mainLoc = makeLoc('MAIN_STOCK', `${ctx.orgName} Main Stock`, 'internal');
    const returnLoc = makeLoc('RETURN_STOCK', `${ctx.orgName} Return Stock`, 'internal');
    const stockLocations = [saleLoc, mainLoc, returnLoc];
    for (const loc of stockLocations) {
      loc.location_id = loc.location_id ?? store.id;
    }
    await slTarget.save(stockLocations);
    ctx.saleLoc = { id: saleLoc.id, code: saleLoc.code, name: saleLoc.name };
    ctx.mainLoc = { id: mainLoc.id, code: mainLoc.code, name: mainLoc.name };
    ctx.returnLoc = { id: returnLoc.id, code: returnLoc.code, name: returnLoc.name };

    const sslTarget = new RawUpsertTarget(
      this.backendDb,
      'store_stock_locations',
      ['id'],
      orgId,
    );
    const existingSsls = await sslTarget.findAll();
    const sslSeen = new Set(existingSsls.map((s) => `${s.store_id}|${s.purpose}`));
    const sslRows: Record<string, any>[] = [];
    const ssl = (storeId: string, purpose: string, stockLocationId: string) => {
      const key = `${storeId}|${purpose}`;
      if (sslSeen.has(key)) return;
      sslSeen.add(key);
      sslRows.push({
        id: randomUUID(),
        organization_id: orgId,
        store_id: storeId,
        purpose,
        stock_location_id: stockLocationId,
        is_active: true,
      });
    };
    ssl('default', 'sale_issue', saleLoc.id);
    ssl('default', 'sale_return', returnLoc.id);
    await sslTarget.save(sslRows);
  }

  private async ensureSaleLoc(ctx: ProvisionContext): Promise<LocationRef> {
    if (ctx.saleLoc) return ctx.saleLoc;
    const locations = await new RawUpsertTarget(
      this.backendDb,
      'stock_locations',
      ['id'],
      ctx.orgId,
    ).findAll();
    const sale = locations.find((loc) => loc.code === 'SALE_STOCK');
    if (!sale) {
      throw new Error(`SALE_STOCK stock location missing for ${ctx.orgCode}`);
    }
    ctx.saleLoc = { id: sale.id, code: sale.code, name: sale.name };
    return ctx.saleLoc;
  }

  // ── backend: stock lots (chunked) ──────────────────────────────────────
  private async stageBackendLots(
    ctx: ProvisionContext,
    cursor: string | null,
    onProgress: StageProgress,
  ): Promise<void> {
    const batch = this.provisionBatchSize();
    let last = cursor;

    for (;;) {
      const rows = await this.pageOrgItems(ctx.orgId, last, batch);
      if (!rows.length) {
        await onProgress(null, 0);
        return;
      }
      const pairs = rows.map((row) => ({
        itemId: row.item_id,
        code: `LOT-${row.code ?? 'ITEM'}`,
      }));
      const codes = pairs.map((pair) => pair.code);
      const existing: Array<{ code: string }> = await this.backendDb.query(
        `SELECT code FROM stock_lots WHERE organization_id = $1 AND code = ANY($2::text[])`,
        [ctx.orgId, codes],
      );
      const existingCodes = new Set(existing.map((row) => row.code));
      const missing = pairs
        .filter((pair) => !existingCodes.has(pair.code))
        .map((pair) => ({
          id: randomUUID(),
          organization_id: ctx.orgId,
          code: pair.code,
        }));
      if (missing.length) {
        await this.insertRows('stock_lots', ['id', 'organization_id', 'code'], missing);
      }
      last = rows[rows.length - 1].item_id;
      await onProgress(last, missing.length);
    }
  }

  // ── backend: opening balances (chunked) ────────────────────────────────
  private async stageBackendBalances(
    ctx: ProvisionContext,
    cursor: string | null,
    onProgress: StageProgress,
  ): Promise<void> {
    const saleLoc = await this.ensureSaleLoc(ctx);
    const batch = this.provisionBatchSize();
    let last = cursor;

    for (;;) {
      const rows = await this.pageOrgItems(ctx.orgId, last, batch);
      if (!rows.length) {
        await onProgress(null, 0);
        return;
      }
      const itemIds = rows.map((row) => row.item_id);
      const codes = rows.map((row) => `LOT-${row.code ?? 'ITEM'}`);

      const [existingBalances, lots] = await Promise.all([
        this.backendDb.query(
          `SELECT item_id FROM stock_balances
           WHERE organization_id = $1 AND location_id = $2 AND item_id = ANY($3::uuid[])`,
          [ctx.orgId, saleLoc.id, itemIds],
        ) as Promise<Array<{ item_id: string }>>,
        this.backendDb.query(
          `SELECT id, code FROM stock_lots WHERE organization_id = $1 AND code = ANY($2::text[])`,
          [ctx.orgId, codes],
        ) as Promise<Array<{ id: string; code: string }>>,
      ]);
      const existingIds = new Set(existingBalances.map((row) => row.item_id));
      const lotByCode = new Map(lots.map((lot) => [lot.code, lot.id]));

      const balanceRows: Record<string, any>[] = [];
      rows.forEach((row, index) => {
        if (existingIds.has(row.item_id)) return;
        const lotCode = codes[index];
        balanceRows.push({
          id: randomUUID(),
          organization_id: ctx.orgId,
          item_id: row.item_id,
          location_id: saleLoc.id,
          lot_id: lotByCode.get(lotCode) ?? null,
          quantity_on_hand: this.openingFor(row.item_id),
          quantity_reserved: 0,
          average_cost: this.costFor(this.retailFor(row.code ?? '')),
          reorder_min_qty: 10,
          reorder_max_qty: 200,
        });
      });
      if (balanceRows.length) {
        await this.insertRows(
          'stock_balances',
          [
            'id',
            'organization_id',
            'item_id',
            'location_id',
            'lot_id',
            'quantity_on_hand',
            'quantity_reserved',
            'average_cost',
            'reorder_min_qty',
            'reorder_max_qty',
          ],
          balanceRows,
        );
      }
      last = rows[rows.length - 1].item_id;
      await onProgress(last, balanceRows.length);
    }
  }

  // ── backend: parties ───────────────────────────────────────────────────
  private async stageBackendParties(ctx: ProvisionContext): Promise<void> {
    const partyTarget = new RawUpsertTarget(this.backendDb, 'parties', ['id'], ctx.orgId);
    const existingParties = await partyTarget.findAll();
    const partyByCode = new Map(existingParties.map((p) => [p.code, p]));
    const partyTemplates: Array<Record<string, unknown>> = [
      { code: `${ctx.orgCode}_WALKIN`, party_type: 'customer', name: 'Adeola Adeyemi' },
      { code: `${ctx.orgCode}_CUST_001`, party_type: 'customer', name: 'Ngozi Okafor' },
      { code: `${ctx.orgCode}_SUP_001`, party_type: 'supplier', name: 'Okafor Pharmaceuticals' },
      { code: `${ctx.orgCode}_SUP_002`, party_type: 'supplier', name: 'Balogun Medical Supplies' },
    ];
    const partyRows = partyTemplates.map((tpl) => {
      const code = tpl.code as string;
      return {
        id: partyByCode.get(code)?.id ?? randomUUID(),
        organization_id: ctx.orgId,
        party_type: tpl.party_type,
        code,
        name: tpl.name as string,
        is_active: true,
      };
    });
    await partyTarget.save(partyRows);
    ctx.parties = partyRows.map((row) => ({
      id: row.id,
      code: row.code,
      partyType: row.party_type as string,
      name: row.name,
    }));
  }

  // ── backend: GL + POS configs ──────────────────────────────────────────
  private async stageBackendPos(ctx: ProvisionContext): Promise<void> {
    const saleLoc = await this.ensureSaleLoc(ctx);
    const orgId = ctx.orgId;

    const glTarget = new RawUpsertTarget(this.backendDb, 'gl_accounts', ['id'], orgId);
    const existingGl = await glTarget.findAll();
    const glByCode = new Map(existingGl.map((g) => [g.account_code as string, g]));
    const glTemplates: Array<{ code: string; name: string; type: string }> = [
      { code: '1000', name: 'Cash & Cash Equivalents', type: 'asset' },
      { code: '1100', name: 'Bank', type: 'asset' },
      { code: '1200', name: 'Accounts Receivable', type: 'asset' },
      { code: '1300', name: 'Inventory', type: 'asset' },
      { code: '2000', name: 'Accounts Payable', type: 'liability' },
      { code: '3000', name: 'Shareholder Equity', type: 'equity' },
      { code: '4000', name: 'Sales Revenue', type: 'income' },
      { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
      { code: '5100', name: 'Operating Expenses', type: 'expense' },
    ];
    const glRows = glTemplates
      .filter((tpl) => !glByCode.has(tpl.code))
      .map((tpl) => ({
        id: randomUUID(),
        organization_id: orgId,
        account_code: tpl.code,
        account_name: tpl.name,
        account_type: tpl.type,
        allows_reconciliation: false,
        is_active: true,
      }));
    if (glRows.length) {
      await glTarget.save(glRows);
    }

    const users =
      ctx.userRows ??
      (await this.userRepository.find({ where: { organizationId: orgId } }));
    const upcTarget = new RawUpsertTarget(
      this.backendDb,
      'user_pos_configs',
      ['user_id'],
      orgId,
    );
    const existingUpcs = await upcTarget.findAll();
    const upcByUserId = new Map(existingUpcs.map((u) => [u.user_id, u]));
    const upcRows = users.map((user) => ({
      id: upcByUserId.get(user.id)?.id ?? randomUUID(),
      user_id: user.id,
      organization_id: orgId,
      stock_location_id: saleLoc.id,
      store_id: 'default',
      allow_a4_print: false,
      allow_pos: true,
      login_timeout_minutes: null,
      auto_select_location: true,
      auto_select_customer: true,
      auto_select_price_list: true,
    }));
    if (upcRows.length) {
      await upcTarget.save(upcRows);
    }
  }

  // ── shared batch writers ───────────────────────────────────────────────
  private async insertIgnore(
    table: string,
    columns: string[],
    rows: Record<string, any>[],
    conflictColumns: string[],
  ): Promise<void> {
    if (!rows.length) return;
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const placeholders = chunk
        .map(
          (_, r) =>
            `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(', ')})`,
        )
        .join(', ');
      const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (${conflictColumns.map((c) => `"${c}"`).join(', ')}) DO NOTHING`;
      await this.backendDb.query(
        sql,
        chunk.flatMap((row) => columns.map((column) => row[column] ?? null)),
      );
    }
  }

  private async insertRows(
    table: string,
    columns: string[],
    rows: Record<string, any>[],
  ): Promise<void> {
    if (!rows.length) return;
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const placeholders = chunk
        .map(
          (_, r) =>
            `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(', ')})`,
        )
        .join(', ');
      await this.backendDb.query(
        `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${placeholders}`,
        chunk.flatMap((row) => columns.map((column) => row[column] ?? null)),
      );
    }
  }

  private async buildResult(ctx: ProvisionContext): Promise<ProvisionResult> {
    await this.ensureLocations(ctx);
    const priceList = ctx.priceList ?? (await this.ensurePriceList(ctx));
    const sale = ctx.saleLoc ?? (await this.ensureSaleLoc(ctx));
    const stockLocations = await new RawUpsertTarget(
      this.backendDb,
      'stock_locations',
      ['id'],
      ctx.orgId,
    ).findAll();
    const main = ctx.mainLoc ?? stockLocations.find((s) => s.code === 'MAIN_STOCK');
    const returnLocation = ctx.returnLoc ?? stockLocations.find((s) => s.code === 'RETURN_STOCK');
    const warehouses = await new RawUpsertTarget(
      this.backendDb,
      'warehouses',
      ['id'],
      ctx.orgId,
    ).findAll();
    const warehouse = ctx.warehouse ?? warehouses.find((w) => w.code === 'MAIN_WH');
    const partyRows = await new RawUpsertTarget(
      this.backendDb,
      'parties',
      ['id'],
      ctx.orgId,
    ).findAll();
    const parties =
      ctx.parties ??
      partyRows.map((p) => ({
        id: p.id,
        code: p.code,
        partyType: p.party_type,
        name: p.name,
      }));
    const itemCodes: Array<{ code: string }> = await this.backendDb.query(
      `SELECT code FROM organisation_items WHERE organization_id = $1 AND code IS NOT NULL ORDER BY code`,
      [ctx.orgId],
    );
    const users =
      ctx.provisionedUsers ??
      (await this.userRepository.find({ where: { organizationId: ctx.orgId } })).map((u) => ({
        username: u.username,
        password: ctx.plainPassword ?? '',
        roles: [],
        organizationId: ctx.orgId,
        locationId: u.locationId,
        email: u.email ?? null,
      }));

    return {
      organizationId: ctx.orgId,
      organizationCode: ctx.orgCode,
      organizationName: ctx.orgName,
      locations: { hq: ctx.hq!, store: ctx.store! },
      priceList,
      stockLocations: {
        sale,
        main: main
          ? { id: main.id, code: main.code, name: main.name }
          : { id: '', code: 'MAIN_STOCK', name: '' },
        returnLocation: returnLocation
          ? { id: returnLocation.id, code: returnLocation.code, name: returnLocation.name }
          : { id: '', code: 'RETURN_STOCK', name: '' },
      },
      warehouses: warehouse
        ? [{ id: warehouse.id, code: warehouse.code, name: warehouse.name }]
        : [],
      parties,
      whitelistedItemCodes: itemCodes.map((row) => row.code),
      users,
      created: ctx.created,
    };
  }

  // Hard teardown of an organisation and everything provisioned for it.
  // Idempotent: when the org doesn't exist, reports `not_found` without error.
  //
  // Every table is deleted in dependency order (children before the rows they
  // reference), bounded by lock/statement timeouts and a wall-clock budget, and
  // the result is truthful: `deprovisioned: true` only when every table was
  // emptied. The old loop swallowed each failure into `could not clean <table>`
  // (frequently with an EMPTY message) and then reported success, which is how
  // orgs kept exactly 4 orphaned users each: `DELETE FROM users` is blocked by
  // refresh_tokens.user_id (NO ACTION FK) and by auth_action_tokens /
  // user_login_events / role_requests on schemas where those columns carry FKs,
  // while roles/locations/organizations were still removed around it.
  async deprovision(code: string): Promise<DeprovisionOutcome> {
    const orgCode = code.toUpperCase();
    const org = await this.organizationRepository.findOne({
      where: { code: orgCode },
      withDeleted: true,
    });
    if (!org) {
      return {
        status: 'not_found',
        deprovisioned: false,
        deleted: 0,
        tables: [],
        failures: [],
        budgetExhausted: false,
      };
    }
    const startedAt = Date.now();
    const identityDb = this.defaultDb();
    const cleaner = new DeprovisionCleaner(
      cleanupOptionsFromEnv(),
      (message) => this.logger.warn(message),
    );

    // ── identity: user-scoped rows first ──────────────────────────────────
    // refresh_tokens.user_id has NO ON DELETE CASCADE, so the tokens must go
    // before the users that own them; the same holds for auth_action_tokens,
    // user_login_events, role_requests and user_roles on schemas that enforce
    // those FKs. role_permissions/user_roles precede the roles they reference.
    const userScoped = 'user_id IN (SELECT id FROM users WHERE organization_id = $1)';
    const identityTable = (table: string, where: string): CleanupStep => ({
      dataSource: identityDb,
      name: `identity.${table}`,
      table,
      where,
    });
    const identitySteps: CleanupStep[] = [
      identityTable('refresh_tokens', userScoped),
      identityTable('auth_action_tokens', userScoped),
      identityTable('user_login_events', userScoped),
      identityTable('role_requests', userScoped),
      identityTable('user_roles', userScoped),
      identityTable(
        'role_permissions',
        'role_id IN (SELECT id FROM roles WHERE organization_id = $1)',
      ),
      identityTable('users', 'organization_id = $1'),
      identityTable('roles', 'organization_id = $1'),
      identityTable('locations', 'organization_id = $1'),
    ];
    const identityResults = await cleaner.run(identitySteps, org.id);
    const identityFailures = identityResults.filter((r) => r.outcome !== 'cleaned');
    if (identityFailures.length > 0) {
      this.logger.error(
        `[deprovision:${orgCode}] identity cleanup incomplete ` +
          `(${identityFailures.map((f) => `${f.name}: ${f.error}`).join('; ')}) — ` +
          'keeping the organizations row for a retry',
      );
    }

    // ── backend: children before the rows they reference ──────────────────
    const orgScoped = 'organization_id = $1';
    const backendTables: Array<[string, string]> = [
      ['user_pos_configs', orgScoped],
      [
        'price_list_items',
        'price_list_id IN (SELECT id FROM "price_lists" WHERE organization_id = $1)',
      ],
      ['stock_balances', orgScoped],
      ['store_stock_locations', orgScoped],
      ['stock_lots', orgScoped],
      ['price_lists', orgScoped],
      ['organisation_payment_providers', orgScoped],
      ['organisation_configs', orgScoped],
      ['organisation_items', orgScoped],
      ['stock_locations', orgScoped],
      ['warehouses', orgScoped],
      ['parties', orgScoped],
    ];
    const backendResults = await cleaner.run(
      backendTables.map(([table, where]) => ({
        dataSource: this.backendDb,
        name: `backend.${table}`,
        table,
        where,
      })),
      org.id,
    );

    // ── emr: demo clinical data + departments per HQ site ─────────────────
    // Order matters: admissions reference visits/patients/wards/beds; visits
    // reference patients; beds reference wards; wards reference departments.
    // The provisioner writes all six tables, so teardown must empty all six —
    // leaving patients/visits/admissions behind made `deprovisioned: true`
    // untrue.
    const emrTables: Array<[string, string]> = [
      ['admissions', orgScoped],
      ['visits', orgScoped],
      ['patients', orgScoped],
      ['beds', orgScoped],
      ['wards', orgScoped],
      ['departments', orgScoped],
    ];
    const emrResults = await cleaner.run(
      emrTables.map(([table, where]) => ({
        dataSource: this.emrDb,
        name: `emr.${table}`,
        table,
        where,
      })),
      org.id,
    );

    const tables = [...identityResults, ...backendResults, ...emrResults];
    const failures = tables.filter((r) => r.outcome !== 'cleaned');

    // Drop the provisioning job before the organization row. If the job row
    // survived, resume-on-boot would re-create the tenant we just deleted.
    if (failures.length === 0) {
      try {
        await identityDb.query(
          'DELETE FROM "provisioning_jobs" WHERE organization_id = $1',
          [org.id],
        );
      } catch (err: any) {
        failures.push({
          name: 'identity.provisioning_jobs',
          table: 'provisioning_jobs',
          outcome: 'failed',
          deleted: 0,
          attempts: 1,
          error: err?.message ? String(err.message) : 'could not delete provisioning job',
          code: err?.code,
        });
      }
    }

    // The organizations row is the retry marker: delete it only after EVERY
    // target is clean. Previously it was deleted as soon as the identity tables
    // were empty, so a backend/EMR partial failure could never be retried (the
    // next call found no organization and reported `not_found`, leaving the
    // stock/clinical rows orphaned).
    if (failures.length === 0) {
      try {
        await identityDb.query('DELETE FROM "organizations" WHERE id = $1', [org.id]);
      } catch (err: any) {
        failures.push({
          name: 'identity.organizations',
          table: 'organizations',
          outcome: 'failed',
          deleted: 0,
          attempts: 1,
          error: err?.message ? String(err.message) : 'could not delete organizations row',
          code: err?.code,
        });
      }
    } else {
      this.logger.error(
        `[deprovision:${orgCode}] cleanup incomplete (${failures.length} table(s)) — ` +
          'keeping the organizations row for a retry',
      );
    }

    const deprovisioned = failures.length === 0;
    const durationMs = Date.now() - startedAt;
    const outcome: DeprovisionOutcome = {
      status: deprovisioned ? 'deprovisioned' : 'partial',
      deprovisioned,
      deleted: tables.reduce((sum, r) => sum + (r.deleted || 0), 0),
      tables,
      failures,
      budgetExhausted: cleaner.budgetExhausted,
    };

    if (deprovisioned) {
      this.logger.log(
        `Deprovisioned ${orgCode} [${org.id}] — ${outcome.deleted} rows in ${durationMs}ms`,
      );
    } else {
      this.logger.error(
        `[deprovision:${orgCode}] PARTIAL (${durationMs}ms, ${outcome.deleted} rows deleted): ` +
          failures.map((f) => `${f.name}=${f.outcome}: ${f.error}`).join('; '),
      );
    }
    return outcome;
  }

  async status(code: string): Promise<ProvisionStatus> {
    const orgCode = code.toUpperCase();
    const org = await this.organizationRepository.findOne({
      where: { code: orgCode },
      withDeleted: true,
    });
    if (!org) {
      return { exists: false, code: orgCode, organizationId: null };
    }
    return {
      exists: true,
      code: orgCode,
      organizationId: org.id,
      counts: await this.provisionedCounts(org.id),
    };
  }

  /** Row counts per provisioned table — the onboarding e2e's drift signal. */
  private async provisionedCounts(orgId: string): Promise<ProvisionStatus['counts']> {
    const count = async (db: { query: (sql: string, params?: unknown[]) => Promise<any> }, sql: string) => {
      try {
        const rows = await db.query(sql, [orgId]);
        return Number(rows?.[0]?.count ?? 0);
      } catch {
        return -1;
      }
    };

    return {
      identity: {
        roles: await count(this.defaultDb(), 'SELECT COUNT(*)::int AS count FROM roles WHERE organization_id = $1'),
        users: await count(this.defaultDb(), 'SELECT COUNT(*)::int AS count FROM users WHERE organization_id = $1'),
        role_permissions: await count(
          this.defaultDb(),
          'SELECT COUNT(*)::int AS count FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE organization_id = $1)',
        ),
        user_roles: await count(
          this.defaultDb(),
          'SELECT COUNT(*)::int AS count FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)',
        ),
      },
      backend: {
        organisation_items: await count(this.backendDb, 'SELECT COUNT(*)::int AS count FROM organisation_items WHERE organization_id = $1'),
        price_lists: await count(this.backendDb, 'SELECT COUNT(*)::int AS count FROM price_lists WHERE organization_id = $1'),
        price_list_items: await count(
          this.backendDb,
          'SELECT COUNT(*)::int AS count FROM price_list_items WHERE price_list_id IN (SELECT id FROM price_lists WHERE organization_id = $1)',
        ),
        stock_locations: await count(this.backendDb, 'SELECT COUNT(*)::int AS count FROM stock_locations WHERE organization_id = $1'),
        stock_balances: await count(this.backendDb, 'SELECT COUNT(*)::int AS count FROM stock_balances WHERE organization_id = $1'),
        parties: await count(this.backendDb, 'SELECT COUNT(*)::int AS count FROM parties WHERE organization_id = $1'),
        user_pos_configs: await count(this.backendDb, 'SELECT COUNT(*)::int AS count FROM user_pos_configs WHERE organization_id = $1'),
        gl_accounts: await count(this.backendDb, 'SELECT COUNT(*)::int AS count FROM gl_accounts WHERE organization_id = $1'),
      },
      emr: {
        departments: await count(this.emrDb, 'SELECT COUNT(*)::int AS count FROM departments WHERE organization_id = $1'),
        wards: await count(this.emrDb, 'SELECT COUNT(*)::int AS count FROM wards WHERE organization_id = $1'),
        beds: await count(this.emrDb, 'SELECT COUNT(*)::int AS count FROM beds WHERE organization_id = $1'),
        patients: await count(this.emrDb, 'SELECT COUNT(*)::int AS count FROM patients WHERE organization_id = $1'),
        visits: await count(this.emrDb, 'SELECT COUNT(*)::int AS count FROM visits WHERE organization_id = $1'),
        admissions: await count(this.emrDb, 'SELECT COUNT(*)::int AS count FROM admissions WHERE organization_id = $1'),
      },
    };
  }

  // ── pricing helpers ────────────────────────────────────────────────────
  // Retail prices come from the optional generated price_list_items.json
  // mirror (resources/price_list_items.json) so a provisioned organisation's
  // price list matches the DEFAULT org's demo pricing; falling back to a
  // deterministic band per item code.
  private retailPriceMap: Map<string, number> | null = null;

  private loadRetailPrices(): Map<string, number> {
    if (this.retailPriceMap) return this.retailPriceMap;
    const map = new Map<string, number>();
    try {
      const file = this.config.get<string>(
        'PROVISION_PRICE_MIRROR',
        'resources/price_list_items.json',
      );
      const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{
        price_list_code: string;
        item_code: string;
        unit_price: number | string;
      }>;
      for (const r of rows) {
        if (r.price_list_code === 'RETAIL_PRICE_LIST') {
          const price = Number(r.unit_price);
          if (Number.isFinite(price) && price > 0) map.set(String(r.item_code), price);
        }
      }
    } catch {
      // Missing / unreadable mirror — derive prices instead.
    }
    this.retailPriceMap = map;
    return map;
  }

  private hashOf(value: string): number {
    let h = 0;
    for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
  }

  private retailFor(code: string): number {
    if (!code) return 0;
    const fromList = this.loadRetailPrices().get(code);
    if (fromList) return fromList;
    return 250 + (this.hashOf(code) % 11) * 250;
  }

  private costFor(retail: number): number {
    return Math.round(retail * 0.6 * 100) / 100;
  }

  private openingFor(itemId: string): number {
    return 40 + (this.hashOf(itemId) % 18) * 20;
  }

  // The identity service's own (default) TypeORM connection.
  private defaultDb(): DataSource {
    return this.organizationRepository.manager.connection;
  }
}
