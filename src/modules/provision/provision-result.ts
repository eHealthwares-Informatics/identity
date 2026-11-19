import type { CleanupResult } from './services/deprovision-cleanup';

export interface ProvisionedUser {
  username: string;
  password: string;
  roles: string[];
  organizationId: string;
  locationId: string | null;
  email?: string | null;
}

export interface ProvisionResult {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  locations: {
    hq: { id: string; code: string; name: string };
    store: { id: string; code: string; name: string };
  };
  priceList: { id: string; code: string; name: string };
  stockLocations: {
    sale: { id: string; code: string; name: string };
    main: { id: string; code: string; name: string };
    returnLocation: { id: string; code: string; name: string };
  };
  warehouses: Array<{ id: string; code: string; name: string }>;
  parties: Array<{ id: string; code: string; partyType: string; name: string }>;
  whitelistedItemCodes: string[];
  users: ProvisionedUser[];
  created: boolean;
}

export interface ProvisionStatus {
  exists: boolean;
  code: string;
  organizationId: string | null;
  /**
   * Row counts for the tables the provisioner writes. Used by the onboarding
   * e2e to prove a real tenant was created (and torn down) without needing the
   * rxsoft/EMR services running. `-1` means the count could not be read (table
   * missing / query failed) — callers should treat that as drift, not zero.
   */
  counts?: {
    identity: Record<string, number>;
    backend: Record<string, number>;
    emr: Record<string, number>;
  };
}

// Result of a teardown. `deprovisioned` is only true when every table was
// emptied — partial cleanup reports `partial` and lists what failed, so a
// blocked DELETE can never look like success (identity#2 / seed#13).
export interface DeprovisionOutcome {
  status: 'deprovisioned' | 'partial' | 'not_found';
  deprovisioned: boolean;
  deleted: number;
  tables: CleanupResult[];
  failures: CleanupResult[];
  budgetExhausted: boolean;
}
