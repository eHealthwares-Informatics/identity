import { AuthController } from './auth.controller';

/**
 * rxsoft-qa#800. `GET /auth/me` must report how the effective permissions were
 * resolved — the access-control ladder consumes it (Phase-1 e2e asserts
 * `store.permissionMode === 'org'`), and Phase 3's `'user'` mode has nothing to
 * consume without it.
 *
 * The field was added in identity#7 and then silently lost when a later merge
 * resolved `auth.controller.ts` to the pre-#7 side — the PR stayed in the DAG,
 * so ancestry checks passed while the tree no longer had it. Hence this test:
 * it fails on the *tree*, which is what actually ships.
 */
describe('AuthController.me (rxsoft-qa#800)', () => {
  const controller = new AuthController(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  const requestUser = {
    sub: 'user-1',
    username: 'owner',
    roles: ['admin'],
    permissions: ['rxsoft.catalog'],
  } as any;

  it('returns permissionMode so the UI ladder can resolve its mode', () => {
    const result = controller.me(requestUser);

    expect(result.permissionMode).toBe('org');
  });

  it('still returns the rest of the profile', () => {
    const result = controller.me(requestUser);

    expect(result).toMatchObject({
      id: 'user-1',
      username: 'owner',
      roles: ['admin'],
      permissions: ['rxsoft.catalog'],
    });
    expect(Array.isArray(result.modules)).toBe(true);
  });
});
