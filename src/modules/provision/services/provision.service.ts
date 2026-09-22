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
  DEFAULT_ORGANIZATION_ID,
  LOCATION_HQ_CODE,
  LOCATION_HQ_NAME,
  LOCATION_STORE_SUFFIX,
  ORG_TEMPLATE_ROLES,
  ORG_TEMPLATE_USERS,
  RETAIL_PRICE_LIST_CODE,
} from '../org-template';
import { ProvisionOrganisationDto } from '../dto/provision-organisation.dto';
import {
  ProvisionResult,
  ProvisionedUser,
  ProvisionStatus,
} from '../provision-result';
import { RawUpsertTarget } from './raw-upsert.target';
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

  async provision(dto: ProvisionOrganisationDto): Promise<ProvisionResult> {
    const orgCode = dto.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const orgName = dto.name.trim();
    const password = dto.password ?? 'password';
    if (!orgCode || !orgName) {
      throw new BadRequestException('code and name are required');
    }

    // ── identity: organizations ─────────────────────────────────────────
    const org = await this.organizationRepository.findOne({
      where: { code: orgCode },
      withDeleted: true,
    });
    const created = !org;
    const orgId = org?.id ?? randomUUID();
    await this.organizationRepository.save({
      id: orgId,
      code: orgCode,
      name: orgName,
      isActive: true,
      deletedAt: null,
    });
    this.logger.log(`Provisioning organisation ${orgCode} [${orgId}]`);

    // ── identity: locations (HQ + store) ────────────────────────────────
    const storeCode = (dto.storeCode ?? LOCATION_STORE_SUFFIX).toUpperCase();
    const existingLocs = await this.locationRepository.find({
      where: { organizationId: orgId },
      withDeleted: true,
    });
    const byLocCode = new Map(existingLocs.map((l) => [l.code, l]));
    const hq = byLocCode.get(LOCATION_HQ_CODE) ?? {
      id: randomUUID(),
      organizationId: orgId,
      code: LOCATION_HQ_CODE,
      name: `${orgName} ${LOCATION_HQ_NAME}`,
      parentId: null,
      isActive: true,
    };
    const store = byLocCode.get(storeCode) ?? {
      id: randomUUID(),
      organizationId: orgId,
      code: storeCode,
      name: `${orgName} Store`,
      parentId: null,
      isActive: true,
    };
    store.parentId = store.parentId ?? hq.id;
    await this.locationRepository.save([hq, store]);

    // ── emr: default departments at the HQ site ─────────────────────────
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
    this.logger.log(`Provisioning ${departmentRows.length} EMR departments for ${orgCode}`);

    // ── identity: org-scoped roles ─────────────────────────────────────
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

    // ── identity: role_permissions (junction, composite PK) ─────────────
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

    // ── identity: users ─────────────────────────────────────────────────
    const allUsers = await this.userRepository.find({ withDeleted: true });
    const usersByOrgUsername = new Map(
      allUsers.map((u) => [`${u.organizationId}|${u.username}`, u]),
    );
    const ownerEmail = dto.ownerEmail?.trim().toLowerCase();
    if (ownerEmail) {
      const emailOwner = allUsers.find(
        (u) => String(u.email ?? '').toLowerCase() === ownerEmail && u.deletedAt == null,
      );
      if (emailOwner && emailOwner.organizationId !== orgId) {
        throw new ConflictException(`Account with email "${ownerEmail}" already exists`);
      }
    }
    const passwordHash = await this.passwordHasher.hash(password);
    const userRows: UserOrmEntity[] = [];
    const usernameBySuffix = new Map<string, string>();
    for (const tpl of ORG_TEMPLATE_USERS) {
      const isOwner = tpl.suffix === 'OWNER';
      const username = isOwner
        ? ownerEmail ?? dto.ownerUsername ?? `${orgCode}_${tpl.suffix}`
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
      const existing =
        sameOrgOwner ?? usersByOrgUsername.get(`${orgId}|${username}`);
      const loc = tpl.locationCode === storeCode ? store : hq;
      userRows.push({
        id: existing?.id ?? randomUUID(),
        organizationId: orgId,
        username,
        passwordHash,
        isActive: true,
        locationId: loc.id,
        email: isOwner ? ownerEmail ?? null : null,
        deletedAt: null,
      } as UserOrmEntity);
      usernameBySuffix.set(tpl.suffix, username);
    }
    await this.userRepository.save(userRows);
    const userIdByName = new Map(userRows.map((u) => [u.username, u.id]));

    // ── identity: user_roles (junction, composite PK) ───────────────────
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

    const provisionedUsers: ProvisionedUser[] = userRows.map((u) => {
      const suffix = [...usernameBySuffix.entries()].find(
        ([, name]) => name === u.username,
      )?.[0];
      const roles = suffix
        ? (ORG_TEMPLATE_USERS.find((t) => t.suffix === suffix)?.roles ?? [])
        : [];
      return {
        username: u.username,
        password,
        roles,
        organizationId: orgId,
        locationId: u.locationId,
        email: u.email ?? null,
      };
    });

    // ── backend: whitelist global items into organisation_items ─────────
    const itemTarget = new RawUpsertTarget(this.backendDb, 'items');
    const items = await itemTarget.findAll();
    // Global items no longer carry an is_active column — activity is decided
    // per organisation via organisation_items.is_active (whitelist/blacklist).

    // Item codes are global (items own them via the items.code column now).
    // Fall back to the DEFAULT org's legacy organisation_items code, then to an
    // uppercase name slug, for pre-existing rows that have no code yet.
    const defaultOrgItems = await new RawUpsertTarget(
      this.backendDb,
      'organisation_items',
      ['organization_id', 'item_id'],
      DEFAULT_ORGANIZATION_ID,
    ).findAll();
    const defaultOrgCodeByItem = new Map(defaultOrgItems.map((o) => [o.item_id, o]));
    const orgCodeForItem = (item: Record<string, any>): string => {
      if (item.code) return String(item.code);
      const ov = defaultOrgCodeByItem.get(item.id);
      if (ov?.code) return String(ov.code);
      return String(item.name)
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '_')
        .slice(0, 60);
    };

    const selectedItems =
      dto.whitelistItems === 'all' || !dto.items?.length
        ? items
        : items.filter((i) => dto.items!.includes(orgCodeForItem(i)));

    const orgItemTarget = new RawUpsertTarget(
      this.backendDb,
      'organisation_items',
      ['organization_id', 'item_id'],
      orgId,
    );
    const existingOrgItems = await orgItemTarget.findAll();
    const existingOrgItemByItem = new Map(existingOrgItems.map((o) => [o.item_id, o]));
    const resolvedCodeByItemId = new Map<string, string>();
    const orgItemRows: Record<string, any>[] = [];
    for (const item of selectedItems) {
      const code = orgCodeForItem(item);
      orgItemRows.push({
        id: existingOrgItemByItem.get(item.id)?.id ?? randomUUID(),
        organization_id: orgId,
        item_id: item.id,
        code: null,
        is_active: true,
        alias: null,
      });
      resolvedCodeByItemId.set(item.id, code);
    }
    await orgItemTarget.save(orgItemRows);

    // ── backend: whitelist global payment providers into
    // ── organisation_payment_providers (items-style per-org enablement) ──
    const providerTarget = new RawUpsertTarget(this.backendDb, 'payment_providers');
    const providers = await providerTarget.findAll();
    const orgProviderTarget = new RawUpsertTarget(
      this.backendDb,
      'organisation_payment_providers',
      ['organization_id', 'payment_provider_id'],
      orgId,
    );
    const existingOrgProviders = await orgProviderTarget.findAll();
    const existingOrgProviderByProvider = new Map(
      existingOrgProviders.map((o) => [o.payment_provider_id, o]),
    );
    const orgProviderRows = providers.map((provider) => ({
      id: existingOrgProviderByProvider.get(provider.id)?.id ?? randomUUID(),
      organization_id: orgId,
      payment_provider_id: provider.id,
      is_active: true,
      is_default: provider.channel === 'cash',
    }));
    if (orgProviderRows.length) await orgProviderTarget.save(orgProviderRows);

    // ── backend: organisation_configs (org defaults) ────────────────────
    const orgConfigTarget = new RawUpsertTarget(
      this.backendDb,
      'organisation_configs',
      ['organization_id'],
      orgId,
    );
    const existingOrgConfigs = await orgConfigTarget.findAll();
    await orgConfigTarget.save([
      {
        id: existingOrgConfigs[0]?.id ?? randomUUID(),
        organization_id: orgId,
        pos_header: null,
        default_login_timeout_minutes: 480,
        default_allow_pos: true,
        default_allow_a4_print: false,
      },
    ]);

    // ── backend: retail price list + items ──────────────────────────────
    const plTarget = new RawUpsertTarget(
      this.backendDb,
      'price_lists',
      ['organization_id', 'code'],
      orgId,
    );
    const existingPls = await plTarget.findAll();
    const pl = existingPls.find((p) => p.code === RETAIL_PRICE_LIST_CODE) ?? {
      id: randomUUID(),
    };
    await plTarget.save([
      {
        id: pl.id,
        organization_id: orgId,
        code: RETAIL_PRICE_LIST_CODE,
        name: 'Retail Price List',
        is_default: true,
        is_active: true,
      },
    ]);

    const pliTarget = new RawUpsertTarget(this.backendDb, 'price_list_items', [
      'price_list_id',
      'item_id',
    ]);
    const existingPlis = await pliTarget.findAll();
    const pliSeen = new Set(existingPlis.map((r) => `${r.price_list_id}|${r.item_id}`));
    const pliRows: Record<string, any>[] = [];
    for (const orgItem of orgItemRows) {
      const key = `${pl.id}|${orgItem.item_id}`;
      if (pliSeen.has(key)) continue;
      pliSeen.add(key);
      const code = resolvedCodeByItemId.get(orgItem.item_id) ?? '';
      pliRows.push({
        id: randomUUID(),
        price_list_id: pl.id,
        item_id: orgItem.item_id,
        currency_code: 'NGN',
        unit_price: this.retailFor(code),
      });
    }
    await pliTarget.save(pliRows);

    // ── backend: warehouse + stock locations + store mappings ───────────
    const whTarget = new RawUpsertTarget(this.backendDb, 'warehouses', ['id'], orgId);
    const existingWhs = await whTarget.findAll();
    const wh = existingWhs.find((w) => w.code === 'MAIN_WH') ?? { id: randomUUID() };
    await whTarget.save([
      {
        id: wh.id,
        organization_id: orgId,
        store_id: 'default',
        code: 'MAIN_WH',
        name: `${orgName} Main Warehouse`,
        is_active: true,
      },
    ]);

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
    const saleLoc = makeLoc('SALE_STOCK', `${orgName} Sale Stock`, 'inventory');
    const mainLoc = makeLoc('MAIN_STOCK', `${orgName} Main Stock`, 'internal');
    const returnLoc = makeLoc('RETURN_STOCK', `${orgName} Return Stock`, 'internal');
    const stockLocations = [saleLoc, mainLoc, returnLoc];
    // Backfill the identity-site id on pre-existing rows too.
    for (const loc of stockLocations) loc.location_id = loc.location_id ?? store.id;
    await slTarget.save(stockLocations);

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

    // ── backend: opening stock (lots + balances) per whitelisted item ───
    const lotTarget = new RawUpsertTarget(this.backendDb, 'stock_lots', ['id'], orgId);
    const existingLots = await lotTarget.findAll();
    const lotByCode = new Map(existingLots.map((l) => [l.code, l]));
    const lotRows: Record<string, any>[] = [];
    const lotByItemId = new Map<string, any>();
    for (const orgItem of orgItemRows) {
      const code = `LOT-${resolvedCodeByItemId.get(orgItem.item_id) ?? 'ITEM'}`;
      let lot = lotByCode.get(code);
      if (!lot) {
        lot = { id: randomUUID(), organization_id: orgId, code };
      }
      lotRows.push(lot);
      lotByItemId.set(orgItem.item_id, lot);
    }
    await lotTarget.save(lotRows);

    const balTarget = new RawUpsertTarget(this.backendDb, 'stock_balances', ['id'], orgId);
    const existingBals = await balTarget.findAll();
    const balKeyFor = (itemId: string, locationId: string) => `${itemId}|${locationId}`;
    const existingBalKeys = new Set(existingBals.map((b) => balKeyFor(b.item_id, b.location_id)));
    const balRows: Record<string, any>[] = [];
    for (const orgItem of orgItemRows) {
      const itemId = orgItem.item_id;
      const key = balKeyFor(itemId, saleLoc.id);
      if (existingBalKeys.has(key)) continue;
      existingBalKeys.add(key);
      balRows.push({
        id: randomUUID(),
        organization_id: orgId,
        item_id: itemId,
        location_id: saleLoc.id,
        lot_id: lotByItemId.get(itemId)?.id ?? null,
        quantity_on_hand: this.openingFor(itemId),
        quantity_reserved: 0,
        average_cost: this.costFor(this.retailFor(resolvedCodeByItemId.get(itemId) ?? '')),
        reorder_min_qty: 10,
        reorder_max_qty: 200,
      });
    }
    await balTarget.save(balRows);

    // ── backend: minimal parties (walk-in customer + suppliers) ─────────
    const partyTarget = new RawUpsertTarget(this.backendDb, 'parties', ['id'], orgId);
    const existingParties = await partyTarget.findAll();
    const partyByCode = new Map(existingParties.map((p) => [p.code, p]));
    const partyRows: Record<string, any>[] = [];
    const partyTemplates: Array<Record<string, unknown>> = [
      { code: `${orgCode}_WALKIN`, party_type: 'customer', name: 'Adeola Adeyemi' },
      { code: `${orgCode}_CUST_001`, party_type: 'customer', name: 'Ngozi Okafor' },
      { code: `${orgCode}_SUP_001`, party_type: 'supplier', name: 'Okafor Pharmaceuticals' },
      { code: `${orgCode}_SUP_002`, party_type: 'supplier', name: 'Balogun Medical Supplies' },
    ];
    for (const tpl of partyTemplates) {
      const code = tpl.code as string;
      partyRows.push({
        id: partyByCode.get(code)?.id ?? randomUUID(),
        organization_id: orgId,
        party_type: tpl.party_type,
        code,
        name: tpl.name as string,
        is_active: true,
      });
    }
    await partyTarget.save(partyRows);

    // ── backend: user_pos_configs for provisioned users ─────────────────
    const upcTarget = new RawUpsertTarget(
      this.backendDb,
      'user_pos_configs',
      ['user_id'],
      orgId,
    );
    const existingUpcs = await upcTarget.findAll();
    const upcByUserId = new Map(existingUpcs.map((u) => [u.user_id, u]));
    const upcRows: Record<string, any>[] = [];
    for (const user of userRows) {
      upcRows.push({
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
      });
    }
    await upcTarget.save(upcRows);

    const result: ProvisionResult = {
      organizationId: orgId,
      organizationCode: orgCode,
      organizationName: orgName,
      locations: {
        hq: { id: hq.id, code: hq.code, name: hq.name },
        store: { id: store.id, code: store.code, name: store.name },
      },
      priceList: { id: pl.id, code: pl.code, name: 'Retail Price List' },
      stockLocations: {
        sale: { id: saleLoc.id, code: saleLoc.code, name: saleLoc.name },
        main: { id: mainLoc.id, code: mainLoc.code, name: mainLoc.name },
        returnLocation: { id: returnLoc.id, code: returnLoc.code, name: returnLoc.name },
      },
      warehouses: [{ id: wh.id, code: wh.code, name: wh.name }],
      parties: partyRows.map((p) => ({
        id: p.id,
        code: p.code,
        partyType: p.party_type,
        name: p.name,
      })),
      whitelistedItemCodes: orgItemRows.map((o) => resolvedCodeByItemId.get(o.item_id) ?? ''),
      users: provisionedUsers,
      created,
    };
    this.logger.log(
      `Provisioned ${orgCode}: ${orgItemRows.length} items, ${roleRows.length} roles, ${partyRows.length} parties`,
    );
    return result;
  }

  // Hard teardown of an organisation and everything provisioned for it.
  // Idempotent: when the org doesn't exist, returns false without error.
  async deprovision(code: string): Promise<boolean> {
    const orgCode = code.toUpperCase();
    const org = await this.organizationRepository.findOne({
      where: { code: orgCode },
      withDeleted: true,
    });
    if (!org) {
      return false;
    }
    const orgId = org.id;

    const identityDeps: Array<[string, string]> = [
      ['refresh_tokens', 'user_id IN (SELECT id FROM users WHERE organization_id = $1)'],
      ['user_login_events', 'user_id IN (SELECT id FROM users WHERE organization_id = $1)'],
      ['user_roles', 'user_id IN (SELECT id FROM users WHERE organization_id = $1)'],
      ['role_permissions', 'role_id IN (SELECT id FROM roles WHERE organization_id = $1)'],
      ['users', 'organization_id = $1'],
      ['roles', 'organization_id = $1'],
      ['locations', 'organization_id = $1'],
    ];
    for (const [table, where] of identityDeps) {
      try {
        await this.defaultDb().query(`DELETE FROM "${table}" WHERE ${where}`, [org.id]);
      } catch (err: any) {
        this.logger.warn(
          `[deprovision:${orgCode}] could not clean ${table}: ${err.message}`,
        );
      }
    }
    await this.defaultDb().query('DELETE FROM "organizations" WHERE id = $1', [org.id]);

    const backendTables: string[] = [
      'user_pos_configs',
      'stock_balances',
      'store_stock_locations',
      'stock_lots',
      'price_lists',
      'organisation_configs',
      'organisation_payment_providers',
      'organisation_items',
      'stock_locations',
      'warehouses',
      'parties',
    ];
    for (const table of backendTables) {
      try {
        await this.backendDb.query(
          `DELETE FROM "${table}" WHERE organization_id = $1`,
          [org.id],
        );
      } catch (err: any) {
        this.logger.warn(
          `[deprovision:${orgCode}] could not clean ${table}: ${err.message}`,
        );
      }
    }
    // price_list_items has no org column — clean via the org's price lists.
    try {
      await this.backendDb.query(
        `DELETE FROM "price_list_items" WHERE price_list_id IN
         (SELECT id FROM "price_lists" WHERE organization_id = $1)`,
        [org.id],
      );
    } catch (err: any) {
      this.logger.warn(
        `[deprovision:${orgCode}] could not clean price_list_items: ${err.message}`,
      );
    }

    try {
      await this.emrDb.query('DELETE FROM "departments" WHERE organization_id = $1', [
        org.id,
      ]);
    } catch (err: any) {
      this.logger.warn(
        `[deprovision:${orgCode}] could not clean departments: ${err.message}`,
      );
    }

    this.logger.log(`Deprovisioned ${orgCode} [${org.id}]`);
    return true;
  }

  async status(code: string): Promise<ProvisionStatus> {
    const orgCode = code.toUpperCase();
    const org = await this.organizationRepository.findOne({
      where: { code: orgCode },
      withDeleted: true,
    });
    return { exists: Boolean(org), code: orgCode, organizationId: org?.id ?? null };
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
