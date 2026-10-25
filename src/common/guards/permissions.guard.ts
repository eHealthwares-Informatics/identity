import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { permissionMatches } from '../utils/permission-matcher';

type UserWithPermissions = { permissions?: string[]; sub?: string; username?: string };

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly reflector: Reflector) {}

  private userLabel(request: { user?: UserWithPermissions }): string {
    const user = request.user;
    return user?.sub ?? user?.username ?? 'unknown';
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: UserWithPermissions }>();
    const userPerms = request.user?.permissions ?? [];

    const isAllowed = requiredPermissions.some((required) =>
      userPerms.some((userPerm) => permissionMatches(userPerm, required)),
    );

    if (!isAllowed) {
      this.logger.warn(
        `Authorization failed: insufficient permissions (user=${this.userLabel(request)}, userPermissions=[${userPerms.join(
          ', ',
        )}], required=[${requiredPermissions.join(', ')}])`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
