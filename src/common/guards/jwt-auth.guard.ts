import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { resolveTenantClaims } from '../tenant-context';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  private userLabel(request: { user?: unknown }): string {
    const user = request.user as
      | { sub?: string; username?: string }
      | undefined;
    return user?.sub ?? user?.username ?? 'unauthenticated';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: unknown;
    }>();

    // Allow internal service-to-service calls via API key
    const rawApiKey = request.headers['x-api-key'];
    const apiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey;
    const internalKey = this.configService.get<string>('INTERNAL_API_KEY');
    if (apiKey && internalKey && apiKey === internalKey) {
      request.user = resolveTenantClaims(
        {
          sub: 'system',
          organizationId: '',
          username: 'system',
          roles: ['super_admin'],
          permissions: [],
        },
        request.headers,
      );
      this.logger.debug(`Internal service-to-service call authenticated (system)`);
      return true;
    }

    const rawAuthHeader = request.headers.authorization;
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn(
        `Authentication failed: missing bearer token (path=${(request as Record<string, unknown>).url ?? 'unknown'}, user=${this.userLabel(request)})`,
      );
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    // SECURITY: no hardcoded secret fallback — a misconfigured deployment must
    // fail loudly (500 with a clear message) instead of silently verifying
    // tokens with a well-known default. JWT_ACCESS_SECRET must be set in env
    // and shared with identity (the token issuer).
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      this.logger.error('JWT_ACCESS_SECRET is not configured');
      throw new InternalServerErrorException('JWT_ACCESS_SECRET is not configured');
    }
    try {
      const payload = await this.jwtService.verifyAsync<Record<string, any>>(token, { secret });
      // Normalise `organizationId: ""` to null and apply super-admin header
      // overrides so no consumer receives a blank uuid.
      request.user = resolveTenantClaims(payload, request.headers);
      this.logger.debug(`Access token verified for user=${this.userLabel(request)}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `Authentication failed: invalid access token (user=${this.userLabel(request)}, reason=${String((error as Error)?.message)})`,
      );
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
