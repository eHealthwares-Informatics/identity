import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ORG_REPOSITORY } from '../../modules/auth/services/identity.di-tokens';
import type { OrganizationRepository } from '../../modules/organizations/repositories/organization.repository';

/**
 * Resolves the organisation from the request `Host` header by looking up the
 * organisation's `domain` column.
 *
 * When a matching organisation is found, its `organizationId` is attached to
 * `req.organizationId` so that website/public auth routes (OTP, OAuth, login)
 * can scope the session to the correct tenant instead of falling back to the
 * hardcoded `SHOPPER_DEFAULT_ORGANIZATION_ID`.
 *
 * When no matching organisation is found, the request continues unchanged —
 * the caller can fall back to the default org.
 */
@Injectable()
export class OrganizationDomainResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(OrganizationDomainResolverMiddleware.name);

  constructor(
    @Inject(ORG_REPOSITORY)
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const host = req.headers.host;
    if (!host) {
      next();
      return;
    }

    // Strip port number from host (e.g. "acme.clinic.com:8092" -> "acme.clinic.com")
    const domain = host.split(':')[0].toLowerCase();

    // Skip resolution for IP addresses and localhost
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain) || domain === 'localhost' || domain === '127.0.0.1') {
      next();
      return;
    }

    this.logger.debug(`Domain resolution attempt: domain=${domain}`);

    try {
      const organization = await this.organizationRepository.findByDomain(domain);
      if (organization) {
        (req as Record<string, unknown>).organizationId = organization.id;
        this.logger.log(
          `Domain resolved: domain=${domain} -> organizationId=${organization.id}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Domain resolution failed: domain=${domain} reason=${String((error as Error)?.message)}`,
      );
    }

    next();
  }
}
