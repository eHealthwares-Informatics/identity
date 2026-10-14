import { MODULE_PERMISSIONS } from './permission-definitions.data';

/**
 * In-repo integrity of the catalog itself. The cross-repo check (does every code
 * referenced by the sidebar / org template exist here?) lives in
 * `src/scripts/check-catalog-coverage.ts` — it needs the sibling repos, so it
 * runs as a CLI/CI gate rather than a unit test.
 */
describe('permission catalog integrity', () => {
  const codes = MODULE_PERMISSIONS.flatMap((module) => module.permissions.map((p) => p.code));

  it('has no duplicate codes', () => {
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every module exposes its own parent code (the default wildcard)', () => {
    for (const module of MODULE_PERMISSIONS) {
      expect(codes).toContain(module.module);
    }
  });

  it('exposes the rxsoft root parent', () => {
    expect(codes).toContain('rxsoft');
  });

  it('every code is dotted, lowercase and free of `.*`', () => {
    for (const code of codes) {
      expect(code).toMatch(/^[a-z0-9-]+(\.[a-z0-9_-]+)*$/);
      // Parent grants are the default wildcard now — no code should carry `.*`.
      expect(code).not.toContain('*');
    }
  });

  it('every permission carries a resource and action', () => {
    for (const module of MODULE_PERMISSIONS) {
      for (const permission of module.permissions) {
        expect(permission.resource).toBeTruthy();
        expect(permission.action).toBeTruthy();
      }
    }
  });
});
