import { getUserModules } from './permission.data';

const ids = (permissions: string[], roles: string[] = []) =>
  getUserModules(permissions, roles).map((mod) => mod.id);

describe('getUserModules', () => {
  it('gives a super_admin every module', () => {
    expect(ids(['*'], ['super_admin'])).toContain('admin');
  });

  it('keeps the Admin module for a compressed rxsoft.* grant', () => {
    // The `admin` role holds rxsoft.admin.* (among others); login compresses
    // the whole set down to `rxsoft.*`, so the module must not be dropped.
    expect(ids(['rxsoft.*'])).toEqual(
      expect.arrayContaining(['rxsoft', 'admin', 'website', 'identity']),
    );
  });

  it('derives the Admin module from a concrete rxsoft.admin grant', () => {
    expect(ids(['rxsoft.admin.settings.read'])).toContain('admin');
  });

  it('does not grant the Admin module from catalog-only permissions', () => {
    expect(ids(['rxsoft.catalog.item.read'])).not.toContain('admin');
  });

  it('matches roots from either direction', () => {
    // A nested leaf under the root grants the module...
    expect(ids(['rxsoft.website.content.read'])).toContain('website');
    // ...and a broad grant covering the root grants it too.
    expect(ids(['rxsoft.website'])).toContain('website');
  });
});
