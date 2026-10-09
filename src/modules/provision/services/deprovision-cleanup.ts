import { DataSource, QueryResult } from 'typeorm';

// Bounded, chunked, dependency-ordered DELETE helper for the identity-side
// teardown (identity#2). The deprovision path used to swallow each failure into
// a WARN with an empty message and then report `Deprovisioned: true`, so a
// single blocked table left orphaned rows that nobody could see:
//
//  - every statement runs in its own transaction with lock_timeout +
//    statement_timeout, so one blocked table (a hang, seed#12) cannot stall the
//    whole request;
//  - the run has a wall-clock budget, so the caller always gets an answer;
//  - every failure returns a non-empty error (message + sqlstate), and the
//    overall status is `partial` unless every table was emptied.

export type CleanupOutcome =
  | 'cleaned'
  | 'failed'
  | 'timeout'
  | 'skipped';

export interface CleanupStep {
  /** the DataSource to run against (identity / backend / emr connections) */
  dataSource: DataSource;
  /** logical name used in reports, e.g. 'identity.refresh_tokens' */
  name: string;
  table: string;
  /**
   * Predicate bound to the organisation id ($1). Use $1 — never inline the id,
   * e.g. 'organization_id = $1' or
   *      'user_id IN (SELECT id FROM users WHERE organization_id = $1)'.
   */
  where: string;
}

export interface CleanupResult {
  name: string;
  table: string;
  outcome: CleanupOutcome;
  deleted: number;
  /** rows still present — counted whenever the outcome is not 'cleaned' */
  remaining?: number;
  /** never empty: always carries a message, a sqlstate, or both */
  error?: string;
  code?: string;
  attempts: number;
}

export interface CleanupOptions {
  chunkRows: number;
  lockTimeoutMs: number;
  statementTimeoutMs: number;
  budgetMs: number;
  maxChunks: number;
}

export const DEFAULT_CLEANUP_OPTIONS: CleanupOptions = {
  chunkRows: 5000,
  lockTimeoutMs: 3000,
  statementTimeoutMs: 8000,
  budgetMs: 20_000,
  maxChunks: 200,
};

export function cleanupOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CleanupOptions {
  const int = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
  };
  return {
    chunkRows: int(env.DEPROVISION_CHUNK_ROWS, DEFAULT_CLEANUP_OPTIONS.chunkRows),
    lockTimeoutMs: int(
      env.DEPROVISION_LOCK_TIMEOUT_MS,
      DEFAULT_CLEANUP_OPTIONS.lockTimeoutMs,
    ),
    statementTimeoutMs: int(
      env.DEPROVISION_STATEMENT_TIMEOUT_MS,
      DEFAULT_CLEANUP_OPTIONS.statementTimeoutMs,
    ),
    budgetMs: int(env.DEPROVISION_BUDGET_MS, DEFAULT_CLEANUP_OPTIONS.budgetMs),
    maxChunks: int(env.DEPROVISION_MAX_CHUNKS, DEFAULT_CLEANUP_OPTIONS.maxChunks),
  };
}

type SqlDriver = 'postgres' | 'sqlite' | 'other';

export function driverOf(dataSource: DataSource): SqlDriver {
  const type = String(dataSource.options?.type ?? '');
  if (type === 'postgres') return 'postgres';
  if (type === 'sqlite' || type === 'better-sqlite3') return 'sqlite';
  return 'other';
}

// Postgres batch delete by ctid; SQLite by rowid.
export function chunkDeleteSql(step: CleanupStep, driver: SqlDriver): string {
  const rowKey = driver === 'sqlite' ? 'rowid' : 'ctid';
  return (
    `DELETE FROM "${step.table}" WHERE ${rowKey} IN ` +
    `(SELECT ${rowKey} FROM "${step.table}" WHERE ${step.where} LIMIT $2)`
  );
}

export function countRemainingSql(step: CleanupStep): string {
  return `SELECT COUNT(*) AS remaining FROM "${step.table}" WHERE ${step.where}`;
}

const LOCK_TIMEOUT = '55P03';
const STATEMENT_TIMEOUT = '57014';

function describeError(err: unknown): { message: string; code?: string } {
  const anyErr = err as {
    message?: unknown;
    code?: unknown;
    driverError?: { message?: unknown; code?: unknown };
  };
  const rawMessage =
    (typeof anyErr?.message === 'string' && anyErr.message.trim()) ||
    (typeof anyErr?.driverError?.message === 'string' &&
      anyErr.driverError.message.trim()) ||
    (err instanceof Error && err.name) ||
    (err ? String(err) : '');
  const code =
    typeof anyErr?.code === 'string'
      ? anyErr.code
      : typeof anyErr?.driverError?.code === 'string'
        ? anyErr.driverError.code
        : undefined;
  return { message: rawMessage ? String(rawMessage) : 'unknown database error', code };
}

function outcomeForError(err: unknown): { outcome: CleanupOutcome; error: string; code?: string } {
  const described = describeError(err);
  const isTimeout =
    described.code === LOCK_TIMEOUT || described.code === STATEMENT_TIMEOUT;
  return {
    outcome: isTimeout ? 'timeout' : 'failed',
    error: described.code
      ? `${described.message} (sqlstate ${described.code})`
      : described.message,
    code: described.code,
  };
}

export class DeprovisionCleaner {
  private readonly options: CleanupOptions;
  private readonly deadline: number;

  constructor(
    options: Partial<CleanupOptions> = {},
    private readonly onLog: (message: string) => void = () => undefined,
  ) {
    this.options = { ...DEFAULT_CLEANUP_OPTIONS, ...options };
    this.deadline = Date.now() + Math.max(250, this.options.budgetMs);
  }

  get budgetExhausted(): boolean {
    return Date.now() >= this.deadline;
  }

  private get remainingBudgetMs(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  async run(steps: CleanupStep[], orgId: string): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];
    for (const step of steps) {
      if (this.budgetExhausted) {
        this.onLog(`[deprovision] budget exhausted before ${step.name} — skipped`);
        results.push({
          name: step.name,
          table: step.table,
          outcome: 'skipped',
          deleted: 0,
          attempts: 0,
          error: `skipped: deprovision budget (${this.options.budgetMs}ms) was exhausted`,
        });
        continue;
      }
      results.push(await this.cleanTable(step, orgId));
    }
    return results;
  }

  async cleanTable(step: CleanupStep, orgId: string): Promise<CleanupResult> {
    const driver = driverOf(step.dataSource);
    const sql = chunkDeleteSql(step, driver);
    let deleted = 0;
    let attempts = 0;

    for (;;) {
      if (attempts > 0 && this.budgetExhausted) {
        return this.incomplete(
          step,
          orgId,
          deleted,
          attempts,
          'timeout',
          `deprovision budget exhausted after ${deleted} rows`,
        );
      }
      if (attempts >= this.options.maxChunks) {
        return this.incomplete(
          step,
          orgId,
          deleted,
          attempts,
          'timeout',
          `still deleting after ${attempts} chunks (${deleted} rows) — retry on the next pass`,
        );
      }
      attempts += 1;
      try {
        const affected = await this.executeChunk(step, driver, sql, [
          orgId,
          this.options.chunkRows,
        ]);
        deleted += affected;
        if (affected < this.options.chunkRows) {
          return {
            name: step.name,
            table: step.table,
            outcome: 'cleaned',
            deleted,
            attempts,
          };
        }
      } catch (err) {
        const { outcome, error, code } = outcomeForError(err);
        return this.incomplete(step, orgId, deleted, attempts, outcome, error, code);
      }
    }
  }

  private async incomplete(
    step: CleanupStep,
    orgId: string,
    deleted: number,
    attempts: number,
    outcome: CleanupOutcome,
    error: string,
    code?: string,
  ): Promise<CleanupResult> {
    return {
      name: step.name,
      table: step.table,
      outcome,
      deleted,
      attempts,
      error,
      code,
      remaining: await this.countRemaining(step, orgId),
    };
  }

  private async countRemaining(
    step: CleanupStep,
    orgId: string,
  ): Promise<number | undefined> {
    try {
      const res = await step.dataSource.query(countRemainingSql(step), [orgId]);
      const rows = Array.isArray(res) ? res : [];
      const remaining = Number(rows[0]?.remaining);
      return Number.isFinite(remaining) ? remaining : undefined;
    } catch {
      return undefined;
    }
  }

  // One chunk per transaction: SET LOCAL keeps the timeouts scoped to the
  // connection the statement used, and the short transaction keeps locks from
  // piling up behind a slow table.
  private async executeChunk(
    step: CleanupStep,
    driver: SqlDriver,
    sql: string,
    params: unknown[],
  ): Promise<number> {
    if (driver !== 'postgres') {
      const res = await step.dataSource.query(sql, params);
      return affectedRows(res);
    }

    const statementTimeoutMs = Math.min(
      this.options.statementTimeoutMs,
      Math.max(500, this.remainingBudgetMs),
    );
    const lockTimeoutMs = Math.min(this.options.lockTimeoutMs, statementTimeoutMs);
    const runner = step.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      // Integers only (both settings are ms) — never interpolate anything else.
      await runner.query(`SET LOCAL lock_timeout = ${lockTimeoutMs}`);
      await runner.query(`SET LOCAL statement_timeout = ${statementTimeoutMs}`);
      const res = await runner.query(sql, params, true);
      await runner.commitTransaction();
      return Number((res as QueryResult)?.affected ?? 0);
    } catch (err) {
      await runner.rollbackTransaction().catch(() => undefined);
      throw err;
    } finally {
      await runner.release().catch(() => undefined);
    }
  }
}

export function affectedRows(result: unknown): number {
  if (Array.isArray(result) && typeof result[1] === 'number') return result[1];
  if (result && typeof result === 'object') {
    const affected = (result as { affected?: unknown }).affected;
    if (typeof affected === 'number') return affected;
    const rowCount = (result as { rowCount?: unknown }).rowCount;
    if (typeof rowCount === 'number') return rowCount;
  }
  return 0;
}
