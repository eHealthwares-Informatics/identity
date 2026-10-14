import { PermissionCatalogService } from '../services/permission-catalog.service';
import { PermissionsController } from './permissions.controller';

describe('PermissionsController', () => {
  const controller = new PermissionsController(new PermissionCatalogService());

  it('listModules returns the module-grouped catalog', () => {
    const modules = controller.listModules();
    expect(modules.length).toBeGreaterThan(0);
    expect(modules[0].permissions.length).toBeGreaterThan(0);
  });

  it('listCodes returns the concrete catalog codes', () => {
    const result = controller.listCodes();
    expect(result.total).toBe(result.codes.length);
    expect(result.codes).toContain('rxsoft.catalog.item.read');
    expect(result.codes).toContain('shop.pos');
    expect(result.codes.some((code) => code.includes('*'))).toBe(false);
  });

  it('expand resolves wildcard grants to concrete codes', () => {
    const result = controller.expand({ codes: ['rxsoft.catalog.*', 'shop.pos'] });
    expect(result.codes).toContain('rxsoft.catalog.item.read');
    expect(result.codes).toContain('shop.pos');
    expect(result.codes.some((code) => code.includes('*'))).toBe(false);
  });

  it('expand tolerates a missing body', () => {
    expect(controller.expand({} as any).codes).toEqual([]);
  });
});
