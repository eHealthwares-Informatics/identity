import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { OrganizationOrmEntity } from '../../organizations/entities/organization.orm-entity';
import { UserOrmEntity } from '../../users/entities/user.orm-entity';
import { PASSWORD_HASHER } from '../../auth/services/identity.di-tokens';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import { ProvisioningJobOrmEntity } from '../entities/provisioning-job.orm-entity';
import type { ProvisionContext } from '../provision-context';
import {
  PROVISION_STAGE_NAMES,
  freshStages,
  type ProvisionJobStatus,
  type ProvisionJobView,
  type ProvisionStageName,
  type ProvisionStageState,
} from '../provision-job.types';
import type { ProvisionStatus } from '../provision-result';
import { ProvisionService } from './provision.service';

/** Structural input accepted from both onboarding DTOs. */
export type ProvisionRequest = {
  code: string;
  name: string;
  password?: string;
  ownerEmail?: string;
  ownerUsername?: string;
  storeCode?: string;
  whitelistItems?: 'all';
  items?: string[];
  /** Accepted for compatibility; the native provisioner always uses its template. */
  template?: string;
};

type ProvisionJobRequestRow = {
  code: string;
  name: string;
  storeCode: string | null;
  ownerEmail: string | null;
  ownerUsername: string | null;
  useSubset: boolean;
  items: string[] | null;
  passwordHash: string;
  created: boolean;
};

export type ProvisionStatusResponse = ProvisionStatus & {
  status?: ProvisionJobStatus | 'not_found';
  stage?: ProvisionStageName | null;
  stages?: ProvisionStageState[];
  error?: string | null;
  attempts?: number;
  jobId?: string;
};

/**
 * Owns the durable provisioning job + the in-process worker.
 *
 * One job at a time (concurrency 1) keeps the identity container's memory flat
 * while the staged, cursor-based writes run. Jobs are persisted before the 202
 * is returned and re-enqueued on boot, so a restart resumes rather than
 * stranding a half-built tenant.
 */
@Injectable()
export class ProvisioningJobService implements OnModuleInit {
  private readonly logger = new Logger(ProvisioningJobService.name);
  private readonly queue: string[] = [];
  private draining = false;

  constructor(
    @InjectRepository(ProvisioningJobOrmEntity)
    private readonly jobRepository: Repository<ProvisioningJobOrmEntity>,
    @InjectRepository(OrganizationOrmEntity)
    private readonly organizationRepository: Repository<OrganizationOrmEntity>,
    @InjectRepository(UserOrmEntity)
    private readonly userRepository: Repository<UserOrmEntity>,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    private readonly provisionService: ProvisionService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const resumable = await this.jobRepository.find({
        where: [{ status: 'pending' }, { status: 'running' }],
        order: { createdAt: 'ASC' },
      });
      for (const job of resumable) {
        this.logger.log(
          `[provision:${job.organizationCode}] resuming ${job.status} job ${job.id}`,
        );
        this.enqueue(job.id);
      }
    } catch (error) {
      // Never block identity boot on the provisioning queue.
      this.logger.warn(
        `Could not load resumable provisioning jobs: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Creates the organisation + job (or returns the existing non-completed job
   * for the same code). The actual provisioning runs in the background worker.
   */
  async createOrGet(input: ProvisionRequest): Promise<ProvisionJobView> {
    const orgCode = input.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const orgName = input.name.trim();
    if (!orgCode || !orgName) {
      throw new BadRequestException('code and name are required');
    }
    const ownerEmail = input.ownerEmail?.trim().toLowerCase() || null;

    const existingOrg = await this.organizationRepository.findOne({
      where: { code: orgCode },
      withDeleted: true,
    });
    if (existingOrg) {
      const existingJob = await this.jobRepository.findOne({
        where: { organizationId: existingOrg.id },
      });
      if (!existingJob) {
        throw new ConflictException(`An organisation with code "${orgCode}" already exists`);
      }
      if (existingJob.status === 'completed') {
        throw new ConflictException(`An organisation with code "${orgCode}" already exists`);
      }
      if (existingJob.status === 'failed') {
        this.resetFailedJob(existingJob);
        await this.jobRepository.save(existingJob);
        this.enqueue(existingJob.id);
      }
      return this.view(existingJob);
    }

    if (ownerEmail) {
      const emailOwner = await this.userRepository.findOne({ where: { email: ownerEmail } });
      if (emailOwner && !emailOwner.deletedAt) {
        throw new ConflictException(
          `Account with email "${ownerEmail}" already exists. Please sign in with that email.`,
        );
      }
    }

    const password = input.password ?? 'password';
    const passwordHash = await this.passwordHasher.hash(password);
    const orgId = randomUUID();
    const job = this.jobRepository.create({
      organizationId: orgId,
      organizationCode: orgCode,
      status: 'pending',
      stage: null,
      stages: freshStages(),
      cursor: {},
      request: {
        code: orgCode,
        name: orgName,
        storeCode: input.storeCode ?? null,
        ownerEmail,
        ownerUsername: input.ownerUsername ?? null,
        useSubset: Boolean(input.items?.length) && input.whitelistItems !== 'all',
        items: input.items ?? null,
        passwordHash,
        created: true,
      } satisfies ProvisionJobRequestRow,
      error: null,
      attempts: 0,
      startedAt: null,
      finishedAt: null,
    });

    try {
      await this.jobRepository.manager.transaction(async (manager) => {
        await manager.save(OrganizationOrmEntity, {
          id: orgId,
          code: orgCode,
          name: orgName,
          isActive: true,
          domain: null,
          deletedAt: null,
        });
        await manager.save(ProvisioningJobOrmEntity, job);
      });
    } catch (error) {
      // A concurrent create for the same code: return that job instead of a 500.
      const racedOrg = await this.organizationRepository.findOne({
        where: { code: orgCode },
        withDeleted: true,
      });
      if (racedOrg) {
        const racedJob = await this.jobRepository.findOne({
          where: { organizationId: racedOrg.id },
        });
        if (racedJob) {
          return this.view(racedJob);
        }
        throw new ConflictException(`An organisation with code "${orgCode}" already exists`);
      }
      throw error;
    }

    this.logger.log(`[provision:${orgCode}] queued job ${job.id}`);
    this.enqueue(job.id);
    return this.view(job);
  }

  /** Job state + provisioned row counts. */
  async status(code: string): Promise<ProvisionStatusResponse> {
    const orgCode = code.toUpperCase();
    const [counts, job] = await Promise.all([
      this.provisionService.status(orgCode),
      this.findJobByCode(orgCode),
    ]);
    if (!job) {
      return {
        ...counts,
        status: counts.exists ? 'completed' : 'not_found',
        stage: null,
        stages: [],
        error: null,
        attempts: 0,
      };
    }
    return {
      ...counts,
      ...this.view(job),
      jobId: job.id,
    };
  }

  /** Requeue a failed job (and any failed stages). Idempotent for running jobs. */
  async resume(code: string): Promise<ProvisionJobView> {
    const job = await this.findJobByCode(code.toUpperCase());
    if (!job) {
      throw new NotFoundException(`No provisioning job for "${code.toUpperCase()}"`);
    }
    if (job.status === 'completed') {
      throw new ConflictException('Organisation provisioning is already complete');
    }
    if (job.status !== 'running') {
      this.resetFailedJob(job);
      await this.jobRepository.save(job);
      this.enqueue(job.id);
    }
    return this.view(job);
  }

  /**
   * Job state for the signed-in user's organisation (sidebar marker).
   * Organisations without a job (legacy / fully provisioned) report completed
   * so the UI hides the marker instead of polling forever.
   */
  async statusForOrganization(
    organizationId: string | null | undefined,
  ): Promise<Omit<ProvisionJobView, 'organizationCode'> & { organizationCode: string | null }> {
    if (!organizationId) {
      return {
        id: '',
        organizationId: '',
        organizationCode: null,
        status: 'completed',
        stage: null,
        stages: [],
        error: null,
        attempts: 0,
      };
    }
    const job = await this.jobRepository.findOne({ where: { organizationId } });
    if (!job) {
      return {
        id: '',
        organizationId,
        organizationCode: null,
        status: 'completed',
        stage: null,
        stages: [],
        error: null,
        attempts: 0,
      };
    }
    return { ...this.view(job), organizationCode: job.organizationCode };
  }

  /** Drops the job row after a successful deprovision. */
  async removeForOrganization(organizationId: string): Promise<void> {
    await this.jobRepository.delete({ organizationId });
  }

  async findJobByCode(orgCode: string): Promise<ProvisioningJobOrmEntity | null> {
    const org = await this.organizationRepository.findOne({
      where: { code: orgCode },
      withDeleted: true,
    });
    if (!org) return null;
    return this.jobRepository.findOne({ where: { organizationId: org.id } });
  }

  private resetFailedJob(job: ProvisioningJobOrmEntity): void {
    job.status = 'pending';
    job.error = null;
    job.stage = null;
    job.stages = (job.stages ?? []).map((stage) =>
      stage.status === 'completed' ? stage : { ...stage, status: 'pending', error: undefined },
    );
  }

  private view(job: ProvisioningJobOrmEntity): ProvisionJobView {
    return {
      id: job.id,
      organizationId: job.organizationId,
      organizationCode: job.organizationCode,
      status: job.status,
      stage: job.stage,
      stages: job.stages ?? [],
      error: job.error,
      attempts: job.attempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }

  private enqueue(jobId: string): void {
    if (!this.queue.includes(jobId)) {
      this.queue.push(jobId);
    }
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const jobId = this.queue.shift()!;
        try {
          await this.process(jobId);
        } catch (error) {
          this.logger.error(
            `[provision] job ${jobId} crashed: ${
              error instanceof Error ? error.stack ?? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      this.draining = false;
      if (this.queue.length > 0) {
        void this.drain();
      }
    }
  }

  private async process(jobId: string): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job || job.status === 'completed') {
      return;
    }

    job.status = 'running';
    job.error = null;
    job.attempts = (job.attempts ?? 0) + 1;
    job.startedAt = job.startedAt ?? new Date();
    job.stages = job.stages?.length ? job.stages : freshStages();
    await this.jobRepository.save(job);

    const request = job.request as ProvisionJobRequestRow | null;
    if (!request?.code || !request?.passwordHash) {
      job.status = 'failed';
      job.error = 'Provisioning job is missing its request payload';
      await this.jobRepository.save(job);
      return;
    }

    const ctx: ProvisionContext = {
      orgId: job.organizationId,
      orgCode: request.code,
      orgName: request.name,
      storeCode: (request.storeCode ?? 'STORE').toUpperCase(),
      ownerEmail: request.ownerEmail,
      ownerUsername: request.ownerUsername,
      useSubset: request.useSubset ?? false,
      items: request.items ?? null,
      passwordHash: request.passwordHash,
      created: request.created ?? true,
    };

    try {
      for (const stageName of PROVISION_STAGE_NAMES) {
        let stage = job.stages.find((entry) => entry.name === stageName);
        if (!stage) {
          stage = { name: stageName, status: 'pending', count: 0 };
          job.stages = [...job.stages, stage];
        }
        if (stage.status === 'completed') {
          continue;
        }

        stage.status = 'running';
        stage.startedAt = stage.startedAt ?? new Date().toISOString();
        stage.error = undefined;
        job.stage = stageName;
        await this.jobRepository.save(job);

        const cursor = job.cursor?.[stageName] ?? null;
        this.logger.log(
          `[provision:${request.code}] stage ${stageName}${cursor ? ` (resume after ${cursor})` : ''}`,
        );

        await this.provisionService.runProvisionStage(
          stageName,
          ctx,
          cursor,
          async (nextCursor, countDelta) => {
            job.cursor = { ...(job.cursor ?? {}), [stageName]: nextCursor };
            stage!.count = (stage!.count ?? 0) + countDelta;
            job.stages = job.stages.map((entry) =>
              entry.name === stageName ? stage! : entry,
            );
            await this.jobRepository.update(job.id, {
              cursor: job.cursor,
              stages: job.stages,
            });
          },
        );

        stage.status = 'completed';
        stage.finishedAt = new Date().toISOString();
        job.cursor = { ...(job.cursor ?? {}), [stageName]: null };
        job.stages = job.stages.map((entry) => (entry.name === stageName ? stage! : entry));
        await this.jobRepository.save(job);
      }

      job.status = 'completed';
      job.stage = null;
      job.finishedAt = new Date();
      await this.jobRepository.save(job);
      this.logger.log(`[provision:${request.code}] completed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.status = 'failed';
      job.error = message;
      if (job.stage) {
        job.stages = job.stages.map((entry) =>
          entry.name === job.stage
            ? { ...entry, status: 'failed', error: message }
            : entry,
        );
      }
      await this.jobRepository.save(job);
      this.logger.error(`[provision:${request.code}] failed at ${job.stage}: ${message}`);
    }
  }
}
