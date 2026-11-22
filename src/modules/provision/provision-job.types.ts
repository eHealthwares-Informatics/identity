/**
 * Async provisioning contract.
 *
 * Onboarding no longer runs inside the HTTP request (a full catalogue whitelist
 * takes far longer than a gateway read timeout and can exceed the identity
 * container's memory limit). `POST /auth/onboard-organization` /
 * `POST /provision` create a job and return 202 immediately; the client polls
 * `GET /provision/status/:code` until the job completes.
 *
 * Stages are ordered and persisted individually. A container restart (or a
 * failure) leaves completed stages marked, so the in-process worker resumes
 * from the first unfinished stage — and the heavy stages additionally persist a
 * cursor so a resumed run continues from the last committed batch.
 */

export const PROVISION_STAGE_NAMES = [
  'identity',
  'emr',
  'identity-access',
  'backend-items',
  'backend-config',
  'backend-pricelist',
  'backend-stock-locations',
  'backend-lots',
  'backend-balances',
  'backend-parties',
  'backend-pos',
] as const;

export type ProvisionStageName = (typeof PROVISION_STAGE_NAMES)[number];

export type ProvisionJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ProvisionStageStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ProvisionStageState {
  name: ProvisionStageName;
  status: ProvisionStageStatus;
  /** Rows written by this stage across (re)runs. */
  count: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

/** Shape returned to the frontend by the status endpoint. */
export interface ProvisionJobView {
  id: string;
  organizationId: string;
  organizationCode: string;
  status: ProvisionJobStatus;
  stage: ProvisionStageName | null;
  stages: ProvisionStageState[];
  error: string | null;
  attempts: number;
  createdAt?: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export function freshStages(): ProvisionStageState[] {
  return PROVISION_STAGE_NAMES.map((name) => ({
    name,
    status: 'pending' as const,
    count: 0,
  }));
}

export function stageLabel(stage: ProvisionStageName): string {
  switch (stage) {
    case 'identity':
      return 'Creating your organisation & locations…';
    case 'emr':
      return 'Provisioning EMR departments, wards & demo patients…';
    case 'identity-access':
      return 'Setting up roles, permissions & users…';
    case 'backend-items':
      return 'Whitelisting catalogue items…';
    case 'backend-config':
      return 'Applying organisation configuration…';
    case 'backend-pricelist':
      return 'Building the retail price list…';
    case 'backend-stock-locations':
      return 'Preparing warehouses & stock locations…';
    case 'backend-lots':
      return 'Creating stock lots…';
    case 'backend-balances':
      return 'Opening stock balances…';
    case 'backend-parties':
      return 'Creating demo parties…';
    case 'backend-pos':
      return 'Creating POS configurations…';
    default:
      return 'Provisioning…';
  }
}
