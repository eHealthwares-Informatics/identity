import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

/** Where a request came from — the audit fields captured on every session row. */
export type RequestOrigin = {
  ip: string | null;
  userAgent: string | null;
};

const UNKNOWN_ORIGIN: RequestOrigin = { ip: null, userAgent: null };

/**
 * Per-request origin (ip / user-agent) without threading it through every use
 * case signature. Populated by `RequestContextMiddleware`; read by the session
 * audit service.
 *
 * Falls back to nulls outside a request (CLI jobs, unit tests), so callers never
 * have to guard.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestOrigin>();

  run<T>(origin: RequestOrigin, work: () => T): T {
    return this.storage.run(origin, work);
  }

  current(): RequestOrigin {
    return this.storage.getStore() ?? UNKNOWN_ORIGIN;
  }

  ip(): string | null {
    return this.current().ip;
  }

  userAgent(): string | null {
    return this.current().userAgent;
  }
}
