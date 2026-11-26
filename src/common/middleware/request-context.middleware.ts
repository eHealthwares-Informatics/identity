import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContextService } from '../request-context/request-context.service';

type RequestLike = {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

/** `::ffff:127.0.0.1` (IPv4-mapped) reads as `127.0.0.1`. */
function normalizeIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith('::ffff:') ? trimmed.slice('::ffff:'.length) : trimmed;
}

/**
 * Best-effort client IP:
 *  1. the first `x-forwarded-for` hop (nginx / ngrok / load balancer),
 *  2. express's `req.ip`,
 *  3. the raw socket address.
 */
export function resolveClientIp(req: RequestLike): string | null {
  const forwarded = req.headers?.['x-forwarded-for'];
  const forwardedList = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = forwardedList?.split(',')[0];
  return normalizeIp(firstHop) ?? normalizeIp(req.ip) ?? normalizeIp(req.socket?.remoteAddress);
}

export function resolveUserAgent(req: RequestLike): string | null {
  const header = req.headers?.['user-agent'];
  const value = Array.isArray(header) ? header[0] : header;
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 512) : null;
}

/**
 * Publishes ip / user-agent for the current request so the session audit rows
 * (login, refresh, logout) record where the session was used from.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.requestContext.run(
      { ip: resolveClientIp(req), userAgent: resolveUserAgent(req) },
      () => next()
    );
  }
}
