import { resolveClientIp, resolveUserAgent } from './request-context.middleware';
import { RequestContextService } from '../request-context/request-context.service';

describe('resolveClientIp', () => {
  it('prefers the first x-forwarded-for hop (proxy / tunnel)', () => {
    expect(
      resolveClientIp({
        headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
        ip: '10.0.0.1',
      }),
    ).toBe('203.0.113.7');
  });

  it('falls back to req.ip, then the socket address', () => {
    expect(resolveClientIp({ ip: '198.51.100.4' })).toBe('198.51.100.4');
    expect(resolveClientIp({ socket: { remoteAddress: '198.51.100.9' } })).toBe(
      '198.51.100.9',
    );
  });

  it('normalises IPv4-mapped IPv6 addresses', () => {
    expect(resolveClientIp({ ip: '::ffff:127.0.0.1' })).toBe('127.0.0.1');
  });

  it('returns null when nothing is available', () => {
    expect(resolveClientIp({})).toBeNull();
    expect(resolveClientIp({ headers: { 'x-forwarded-for': '   ' } })).toBeNull();
  });
});

describe('resolveUserAgent', () => {
  it('trims the header and caps its length', () => {
    expect(resolveUserAgent({ headers: { 'user-agent': '  Firefox/140  ' } })).toBe(
      'Firefox/140',
    );
    expect(
      resolveUserAgent({ headers: { 'user-agent': 'x'.repeat(900) } })?.length,
    ).toBe(512);
  });

  it('returns null when absent', () => {
    expect(resolveUserAgent({ headers: {} })).toBeNull();
  });
});

describe('RequestContextService', () => {
  it('returns nulls outside a request', () => {
    const context = new RequestContextService();
    expect(context.ip()).toBeNull();
    expect(context.userAgent()).toBeNull();
  });

  it('publishes the origin to nested async work', async () => {
    const context = new RequestContextService();
    const seen = await context.run({ ip: '1.2.3.4', userAgent: 'UA/1' }, async () => {
      await Promise.resolve();
      return context.current();
    });
    expect(seen).toEqual({ ip: '1.2.3.4', userAgent: 'UA/1' });
    expect(context.ip()).toBeNull();
  });
});
