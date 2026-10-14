import { compressPermissions } from './permission-set';

describe('compressPermissions', () => {
  it('drops children already covered by a granted parent', () => {
    expect(
      compressPermissions([
        'rxsoft.catalog',
        'rxsoft.catalog.item.read',
        'rxsoft.catalog.item.create',
      ])
    ).toEqual(['rxsoft.catalog']);
  });

  it('keeps distinct grants that no parent covers', () => {
    expect(
      compressPermissions([
        'rxsoft.catalog',
        'rxsoft.catalog.item.read',
        'shop.pos',
        'rxsoft.sales.sale.read',
      ])
    ).toEqual(['rxsoft.catalog', 'shop.pos', 'rxsoft.sales.sale.read']);
  });

  it('collapses everything under the global wildcard', () => {
    expect(compressPermissions(['*', 'rxsoft.catalog.item.read', 'shop.pos'])).toEqual(['*']);
  });

  it('collapses a whole subtree under its root', () => {
    expect(
      compressPermissions([
        'rxsoft',
        'rxsoft.catalog.item.read',
        'rxsoft.sales.sale.create',
        'shop.pos',
      ])
    ).toEqual(['rxsoft', 'shop.pos']);
  });

  it('is a no-op on an already-minimal set', () => {
    expect(compressPermissions(['rxsoft.catalog', 'shop.pos'])).toEqual([
      'rxsoft.catalog',
      'shop.pos',
    ]);
  });

  it('deduplicates', () => {
    expect(compressPermissions(['shop.pos', 'shop.pos'])).toEqual(['shop.pos']);
  });

  it('handles an empty set', () => {
    expect(compressPermissions([])).toEqual([]);
  });

  it('never drops a sibling that only shares a prefix segment', () => {
    // `rxsoft.catalog.item` does NOT cover `rxsoft.catalog.itemX.read`.
    expect(compressPermissions(['rxsoft.catalog.item', 'rxsoft.catalog.itemX.read'])).toEqual([
      'rxsoft.catalog.item',
      'rxsoft.catalog.itemX.read',
    ]);
  });

  it('keeps both when neither covers the other', () => {
    expect(compressPermissions(['rxsoft.catalog', 'rxsoft.sales'])).toEqual([
      'rxsoft.catalog',
      'rxsoft.sales',
    ]);
  });
});
