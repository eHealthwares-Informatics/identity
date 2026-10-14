import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();

    // Allow internal service-to-service calls via API key
    const apiKey = request.headers['x-api-key'];
    const internalKey = this.configService.get<string>('INTERNAL_API_KEY');
    if (apiKey && internalKey && apiKey === internalKey) {
      request.user = { sub: 'system', organizationId: '', username: 'system', roles: ['super_admin'], permissions: [] };
      return true;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    // SECURITY: no hardcoded secret fallback — a misconfigured deployment must
    // fail loudly (500 with a clear message) instead of silently verifying
    // tokens with a well-known default. JWT_ACCESS_SECRET must be set in env
    // and shared with identity (the token issuer).
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new InternalServerErrorException('JWT_ACCESS_SECRET is not configured');
    }
    try {
      request.user = await this.jwtService.verifyAsync(token, { secret });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
