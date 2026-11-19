// Provisioning template for onboarding a new organisation.
//
// This file is a thin typed wrapper around `org-template.json`, which is the
// single source of tenant reference data. Identity owns runtime provisioning
// (production must not depend on the seed service), while seed keeps a
// byte-identical copy for its local CLI/e2e provisioner. The copies are
// intentionally duplicated so each service can ship standalone; the root
// `scripts/check-provision-drift.mjs` fails the build when they diverge.
//
// Roles grant parent/leaf permission codes from the identity catalog. Unknown
// codes are skipped with a warning by the provisioner, never routed to the
// NOT_FOUND sentinel.

import * as template from './org-template.json';

// Stable id of the seeded DEFAULT org (seed/seeds/identity/inline/
// organizations.json code DEFAULT_ORG). Used to carry legacy org-level item
// codes onto newly whitelisted organisations.
export const DEFAULT_ORGANIZATION_ID: string = template.defaultOrganizationId;

export interface RoleTemplate {
  name: string;
  description: string;
  permissions: string[];
}

export const ORG_TEMPLATE_ROLES = template.roles as unknown as Record<string, RoleTemplate>;

export interface UserTemplate {
  suffix: string;
  roles: string[];
  locationCode: string;
}

export const ORG_TEMPLATE_USERS = template.users as unknown as UserTemplate[];

export const LOCATION_HQ_CODE: string = template.locationHqCode;
export const LOCATION_HQ_NAME: string = template.locationHqName;
export const LOCATION_STORE_SUFFIX: string = template.locationStoreSuffix;

export interface DepartmentTemplate {
  code: string;
  name: string;
  type: string;
  description: string;
}

export const DEFAULT_ORG_DEPARTMENTS =
  template.departments as unknown as DepartmentTemplate[];

export const RETAIL_PRICE_LIST_CODE: string = template.retailPriceListCode;

export interface WardTemplate {
  departmentCode: string;
  code: string;
  name: string;
  type: string;
}

export const DEFAULT_ORG_WARDS = template.wards as unknown as WardTemplate[];

/** Beds provisioned per ward (codes `<WARD>-01`…`<WARD>-0N`, STANDARD type). */
export const BEDS_PER_WARD: number = template.bedsPerWard;

/** Bed code → status overrides (the rest stay AVAILABLE). */
export const DEMO_BED_STATUSES: Record<string, string> = template.demoBedStatuses;

export interface DemoPatientTemplate {
  patientId: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
}

export const DEMO_ORG_PATIENTS = template.demoPatients as unknown as DemoPatientTemplate[];

export interface DemoAdmissionTemplate {
  admissionNumber: string;
  patientMrn: string;
  wardCode: string;
  bedCode: string;
  admissionType: string;
  diagnosis: string;
  /** Days before now the patient was admitted. */
  admittedDaysAgo: number;
  status: 'ADMITTED' | 'DISCHARGED';
  dischargeType?: string;
  dischargeSummary?: string;
}

export const DEMO_ORG_ADMISSIONS =
  template.demoAdmissions as unknown as DemoAdmissionTemplate[];
