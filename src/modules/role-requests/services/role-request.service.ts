import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignRoleUseCase } from '../../users/services/assign-role.use-case';
import { CreateRoleRequestDto } from '../dto/role-request.dto';
import { RoleRequestOrmEntity } from '../entities/role-request.orm-entity';

export type RoleRequestView = {
  id: string;
  userId: string;
  organizationId: string | null;
  roleCode: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  requestedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

function toView(r: RoleRequestOrmEntity): RoleRequestView {
  return {
    id: r.id,
    userId: r.userId,
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
  ) {}

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
    return rows.map(toView);
  }

  async listAll(organizationId?: string | null): Promise<RoleRequestView[]> {
    const where = organizationId ? { organizationId } : {};
    const rows = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map(toView);
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
    return toView(saved);
  }
}