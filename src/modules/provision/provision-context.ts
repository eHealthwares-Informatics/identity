import type { UserOrmEntity } from '../users/entities/user.orm-entity';
import type { ProvisionedUser } from './provision-result';
import type { ProvisionStageName } from './provision-job.types';

export type LocationRef = { id: string; code: string; name: string };
export type PriceListRef = { id: string; code: string; name: string };

export interface ProvisionParty {
  id: string;
  code: string;
  partyType: string;
  name: string;
}

/**
 * Mutable context shared by the ordered provisioning stages.
 *
 * Stages that can run after a restart must NOT rely on fields populated by an
 * earlier stage: completed stages are skipped on resume, so each stage re-reads
 * its prerequisites from the database (and only uses context fields as a
 * same-run cache).
 */
export interface ProvisionContext {
  orgId: string;
  orgCode: string;
  orgName: string;
  storeCode: string;
  ownerEmail: string | null;
  ownerUsername: string | null;
  /** When true, `items` limits the whitelist to those codes. */
  useSubset: boolean;
  items: string[] | null;
  /** scrypt hash — the plaintext password never leaves the request. */
  passwordHash: string;
  /** Only available on the synchronous path; never persisted. */
  plainPassword?: string;
  created: boolean;

  // Same-run cache (may be undefined after a resume).
  hq?: LocationRef;
  store?: LocationRef;
  priceList?: PriceListRef;
  saleLoc?: LocationRef;
  mainLoc?: LocationRef;
  returnLoc?: LocationRef;
  warehouse?: { id: string; code: string; name: string };
  userRows?: UserOrmEntity[];
  provisionedUsers?: ProvisionedUser[];
  parties?: ProvisionParty[];
}

export type StageProgress = (
  nextCursor: string | null,
  countDelta: number,
) => Promise<void> | void;

export type StageRunner = (
  stage: ProvisionStageName,
  ctx: ProvisionContext,
  cursor: string | null,
  onProgress: StageProgress,
) => Promise<void>;
