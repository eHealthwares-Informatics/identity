import { PermissionCatalogService, catalogCodes, expandPermissionCodes } from './permission-catalog.service';
import { MODULE_PERMISSIONS } from './permission-definitions.data';

describe('catalogCodes', () => {
  it('includes the shop codes the org template grants (rxsoft-qa#798)', () => {
    const codes = catalogCodes();
    for (const code of [
      'shop.pos',
      'shop.pos.dispense',
      'shop.pos.settings',
      'shop.purchases',
      'shop.purchases.receive',
      'shop.purchases.order',
      'shop.purchases.approve',
    ]) {
      expect(codes).toContain(code);
    }
  });

  it('has no duplicate codes', () => {
    const codes = catalogCodes();
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('expandPermissionCodes', () => {
  const catalog = [
    'rxsoft.catalog.item.read',
    'rxsoft.catalog.item.create',
    'rxsoft.sales.sale.read',
    'rxsoft.sales.sale.create',
    'shop.pos',
    'shop.pos.dispense',
  ];

  it('passes concrete codes through untouched', () => {
    expect(expandPermissionCodes(['rxsoft.sales.sale.read'], catalog)).toEqual([
      'rxsoft.sales.sale.read',
    ]);
  });

  it('keeps a concrete code that is absent from the catalog (surfaced downstream)', () => {
    expect(expandPermissionCodes(['rxsoft.unknown.thing'], catalog)).toEqual([
      'rxsoft.unknown.thing',
    ]);
  });

  it('expands a trailing wildcard to every covered catalog code', () => {
    expect(expandPermissionCodes(['rxsoft.catalog.*'], catalog).sort()).toEqual([
      'rxsoft.catalog.item.create',
      'rxsoft.catalog.item.read',
    ]);
  });

  it('expands a namespace wildcard to everything under it', () => {
    expect(expandPermissionCodes(['rxsoft.*'], catalog).sort()).toEqual([
      'rxsoft.catalog.item.create',
      'rxsoft.catalog.item.read',
      'rxsoft.sales.sale.create',
      'rxsoft.sales.sale.read',
    ]);
  });

  it('expands across modules (shop.* covers shop.pos* but not rxsoft.*)', () => {
    expect(expandPermissionCodes(['shop.*'], catalog).sort()).toEqual([
      'shop.pos',
      'shop.pos.dispense',
    ]);
  });

  it('deduplicates overlapping grants', () => {
    const expanded = expandPermissionCodes(
      ['rxsoft.catalog.*', 'rxsoft.catalog.item.read'],
      catalog
    );
    expect(expanded.sort()).toEqual([
      'rxsoft.catalog.item.create',
      'rxsoft.catalog.item.read',
    ]);
  });

  it('resolves the cashier template to concrete catalog codes', () => {
    const expanded = expandPermissionCodes(
      [
        'rxsoft.catalog.item.read',
        'rxsoft.sales.sale.create',
        'rxsoft.sales.sale.read',
        'rxsoft.inventory.stock.read',
      ],
      catalogCodes()
    );
    // All four are concrete and present in the real catalog.
    expect(expanded).toEqual([
      'rxsoft.catalog.item.read',
      'rxsoft.sales.sale.create',
      'rxsoft.sales.sale.read',
      'rxsoft.inventory.stock.read',
    ]);
  });

  it('resolves the org-template wildcards against the real catalog', () => {
    const expanded = expandPermissionCodes(['rxsoft.*', 'shop.*'], catalogCodes());
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded).toContain('rxsoft.catalog.item.read');
    expect(expanded).toContain('shop.pos');
    // A wildcard must never leak into the result — links reference real rows.
    expect(expanded.some((code) => code.includes('*'))).toBe(false);
  });
});

describe('PermissionCatalogService.syncCatalog', () => {
  function makeService(existing: any[] = []) {
    const repository = {
      find: jest.fn().mockResolvedValue(existing),
      create: jest.fn((value: any) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PermissionCatalogService(repository as any);
    return { service, repository };
  }

  it('inserts every catalog code when the table is empty', async () => {
    const { service, repository } = makeService([]);
    const result = await service.syncCatalog();

    expect(result.inserted).toBe(catalogCodes().length);
    expect(result.updated).toBe(0);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — a second run inserts nothing and touches nothing', async () => {
    // Rows that already match the catalog exactly (no drift).
    const rows = MODULE_PERMISSIONS.flatMap((module) => module.permissions).map((permission) => ({
      code: permission.code,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
    }));

    const { service, repository } = makeService(rows);
    const result = await service.syncCatalog();

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('repairs drifted metadata without inserting', async () => {
    const drifted = catalogCodes().map((code) => ({
      code,
      resource: 'WRONG',
      action: 'WRONG',
      description: 'WRONG',
    }));
    const { service } = makeService(drifted);
    const result = await service.syncCatalog();

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(catalogCodes().length);
  });

  it('throws when run without a database (explicit seed must fail loudly)', async () => {
    const service = new PermissionCatalogService();
    await expect(service.syncCatalog()).rejects.toThrow(/not available/);
  });

  it('never throws on boot, even with no database (postgres down)', async () => {
    const service = new PermissionCatalogService();
    await expect(service.syncCatalogOnBoot()).resolves.toBeUndefined();
  });
});
