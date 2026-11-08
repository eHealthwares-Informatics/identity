import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

type UserWithRoles = { roles?: string[]; sub?: string; username?: string };

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  private userLabel(request: { user?: UserWithRoles }): string {
    const user = request.user;
    return user?.sub ?? user?.username ?? 'unknown';
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: UserWithRoles }>();
    const roles = request.user?.roles ?? [];

    const isAllowed = requiredRoles.some((requiredRole) => roles.includes(requiredRole));

    if (!isAllowed) {
      this.logger.warn(
        `Authorization failed: insufficient role (user=${this.userLabel(request)}, userRoles=[${roles.join(
          ', ',
        )}], required=[${requiredRoles.join(', ')}])`,
      );
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
