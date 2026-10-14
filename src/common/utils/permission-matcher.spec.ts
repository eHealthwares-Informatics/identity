import { permissionMatches } from './permission-matcher';

/**
 * The matcher is byte-shared with rxsoft and the frontend
 * (frontend/src/lib/permissions.ts). These cases pin the contract so the three
 * copies cannot silently drift — the UI must never hide what the API allows.
 */
describe('permissionMatches', () => {
  it('matches exact codes', () => {
    expect(permissionMatches('rxsoft.catalog.item.read', 'rxsoft.catalog.item.read')).toBe(true);
  });

  it('does not match a sibling action', () => {
    expect(permissionMatches('rxsoft.catalog.item.create', 'rxsoft.catalog.item.read')).toBe(false);
  });

  describe('parent grants (the default wildcard)', () => {
    it('a parent code covers its whole subtree', () => {
      expect(permissionMatches('rxsoft.catalog', 'rxsoft.catalog.item.read')).toBe(true);
      expect(permissionMatches('rxsoft.catalog', 'rxsoft.catalog.item.delete')).toBe(true);
      expect(permissionMatches('rxsoft.catalog.item', 'rxsoft.catalog.item.read')).toBe(true);
    });

    it('the root code covers everything beneath it', () => {
      expect(permissionMatches('rxsoft', 'rxsoft.catalog.item.read')).toBe(true);
      expect(permissionMatches('rxsoft', 'rxsoft.sales.sale.create')).toBe(true);
    });

    it('a parent code matches itself', () => {
      expect(permissionMatches('rxsoft.catalog', 'rxsoft.catalog')).toBe(true);
    });

    it('never leaks sideways or across namespaces', () => {
      expect(permissionMatches('rxsoft.catalog', 'rxsoft.sales.sale.read')).toBe(false);
      expect(permissionMatches('rxsoft.catalog', 'lis.order.read')).toBe(false);
      expect(permissionMatches('rxsoft.catalog.item', 'rxsoft.catalog.itemX.read')).toBe(false);
    });

    it('a longer grant than the required code does not match', () => {
      expect(permissionMatches('rxsoft.catalog.item.read.extra', 'rxsoft.catalog.item.read')).toBe(
        false
      );
    });
  });

  describe('legacy `*` segments (kept for existing grants and rows)', () => {
    it('trailing wildcard covers the namespace', () => {
      expect(permissionMatches('rxsoft.*', 'rxsoft.catalog.item.read')).toBe(true);
      expect(permissionMatches('rxsoft.catalog.*', 'rxsoft.catalog.item.delete')).toBe(true);
    });

    it('mid-namespace wildcard matches positionally only', () => {
      expect(permissionMatches('rxsoft.*.read', 'rxsoft.catalog.read')).toBe(true);
      expect(permissionMatches('rxsoft.*.read', 'rxsoft.catalog.item.read')).toBe(false);
    });

    it('global wildcard covers everything', () => {
      expect(permissionMatches('*', 'lis.order.read')).toBe(true);
    });
  });
});
