import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AssignRoleUseCase } from '../../users/services/assign-role.use-case';
import { UserOrmEntity } from '../../users/entities/user.orm-entity';
import { CreateRoleRequestDto } from '../dto/role-request.dto';
import { RoleRequestOrmEntity } from '../entities/role-request.orm-entity';

export type RoleRequestView = {
  id: string;
  userId: string;
  /** Human name for lists: "First Last", else display name, else username. */
  userName: string | null;
  userEmail: string | null;
  organizationId: string | null;
  roleCode: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  requestedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

/** Same precedence as the user profile: names, then display name, then username. */
export function userDisplayName(
  user:
    | { firstName?: string | null; lastName?: string | null; displayName?: string | null; username?: string | null }
    | undefined,
): string | null {
  if (!user) return null;
  const joined = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return joined || user.displayName?.trim() || user.username?.trim() || null;
}

function toView(
  r: RoleRequestOrmEntity,
  user?: UserOrmEntity,
): RoleRequestView {
  return {
    id: r.id,
    userId: r.userId,
    userName: userDisplayName(user),
    userEmail: user?.email ?? null,
    organizationId: r.organizationId,
    roleCode: r.roleCode,
    status: r.status,
    reason: r.reason,
    requestedBy: r.requestedBy,
    decidedBy: r.decidedBy,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class RoleRequestService {
  constructor(
    @InjectRepository(RoleRequestOrmEntity)
    private readonly repo: Repository<RoleRequestOrmEntity>,
    private readonly assignRoleUseCase: AssignRoleUseCase,
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {}

  /** Loads the requesting users for a page of requests in one query. */
  private async withUsers(rows: RoleRequestOrmEntity[]): Promise<RoleRequestView[]> {
    if (!rows.length) return [];
    const users = await this.users.find({
      where: { id: In([...new Set(rows.map((row) => row.userId))]) },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    return rows.map((row) => toView(row, byId.get(row.userId)));
  }

  async request(
    userId: string,
    organizationId: string | null,
    dto: CreateRoleRequestDto,
  ): Promise<RoleRequestView> {
    const existing = await this.repo.findOne({
      where: { userId, roleCode: dto.roleCode, status: 'pending' },
    });
    if (existing) {
      throw new BadRequestException('A pending request for this role already exists');
    }
    const entity = this.repo.create({
      userId,
      organizationId,
      roleCode: dto.roleCode,
      reason: dto.reason ?? null,
      requestedBy: userId,
      status: 'pending',
    });
    const saved = await this.repo.save(entity);
    return toView(saved);
  }

  async listMine(userId: string): Promise<RoleRequestView[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return this.withUsers(rows);
  }

  async listAll(organizationId?: string | null): Promise<RoleRequestView[]> {
    const where = organizationId ? { organizationId } : {};
    const rows = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    return this.withUsers(rows);
  }

  async decide(
    id: string,
    action: 'approve' | 'reject',
    decidedBy: string,
    overrideRoleCode?: string,
  ): Promise<RoleRequestView> {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Role request not found');
    if (req.status !== 'pending') {
      throw new BadRequestException('Request already decided');
    }

    if (action === 'approve' && req.organizationId) {
      const roleCode = overrideRoleCode ?? req.roleCode;
      await this.assignRoleUseCase.execute(req.userId, { roleCode }, req.organizationId);
    }

    req.status = action === 'approve' ? 'approved' : 'rejected';
    if (action === 'approve' && overrideRoleCode) {
      req.roleCode = overrideRoleCode;
    }
    req.decidedBy = decidedBy;
    req.decidedAt = new Date();
    const saved = await this.repo.save(req);
    return toView(saved, await this.users.findOne({ where: { id: saved.userId } }).then((u) => u ?? undefined));
  }
}