// Provisioning templates for onboarding a new organisation.
//
// The provisioning service creates a fully usable tenant (identity roles,
// users + rxsoft reference data: item whitelist, retail price list, stock
// locations, opening balances, parties, POS configs). Roles/permissions here
// intentionally mirror the DEFAULT org seed (seed/seeds/identity/inline) and
// only reference permission codes that exist in the identity permissions table
// — unknown codes are skipped with a warning, never routed to an error.

// Stable id of the seeded DEFAULT org (seed/seeds/identity/inline/
// organizations.json code DEFAULT_ORG). Used to carry legacy org-level item
// codes onto newly whitelisted organisations.
export const DEFAULT_ORGANIZATION_ID = 'df3b4afd-9955-4617-9a82-264cc73dd8b2';

export interface RoleTemplate {
  name: string;
  description: string;
  permissions: string[];
}

// Role -> permission set. `admin` owns the organisation (all business modules
// but not the platform `*` / org-creation boundary, which stays with the
// global super_admin). Operational roles match the guard names rxsoft's
// controllers @Roles lists.
export const ORG_TEMPLATE_ROLES: Record<string, RoleTemplate> = {
  admin: {
    name: 'Administrator',
    description: 'Organisation owner — full business access within the organisation',
    permissions: [
      'rxsoft.*',
      'rxsoft.identity.*',
      'rxsoft.admin.*',
      'rxsoft.catalog.*',
      'rxsoft.sales.*',
      'rxsoft.inventory.*',
      'rxsoft.purchases.*',
      'rxsoft.receivables.*',
      'rxsoft.reports.*',
      'rxsoft.website.*',
      'lis.*',
      'emr.*',
      'conversation.*',
      'communication.*',
      'coding-concept.*',
    ],
  },
  cashier: {
    name: 'Cashier',
    description: 'Point-of-sale operator — run sales, view items and stock',
    permissions: [
      'rxsoft.catalog.item.read',
      'rxsoft.sales.sale.create',
      'rxsoft.sales.sale.read',
      'rxsoft.inventory.stock.read',
    ],
  },
  pharmacist: {
    name: 'Pharmacist',
    description: 'Catalogue maintainer — items, pricing, inventory visibility, dispenses orders',
    permissions: [
      'rxsoft.catalog.item.create',
      'rxsoft.catalog.item.read',
      'rxsoft.catalog.item.update',
      'rxsoft.inventory.stock.read',
      'rxsoft.sales.sale.read',
      'rxsoft.sales.sale.create',
      'rxsoft.reports.*',
      'shop.pos',
      'shop.pos.dispense',
    ],
  },
  pharmacist_assistant: {
    name: 'Pharmacist Assistant',
    description: 'Dispenses prescriptions at the point of sale',
    permissions: [
      'rxsoft.catalog.item.read',
      'rxsoft.inventory.stock.read',
      'rxsoft.sales.sale.read',
      'rxsoft.sales.sale.create',
      'shop.pos',
      'shop.pos.dispense',
    ],
  },
  manager: {
    name: 'Manager',
    description: 'Ops manager — purchases, receivables, reporting',
    permissions: [
      'rxsoft.purchases.order.create',
      'rxsoft.purchases.order.read',
      'rxsoft.purchases.order.update',
      'rxsoft.sales.sale.read',
      'rxsoft.inventory.stock.read',
      'rxsoft.receivables.transaction.read',
      'rxsoft.receivables.transaction.create',
      'rxsoft.reports.*',
    ],
  },
  inventory_clerk: {
    name: 'Inventory Clerk',
    description: 'Stock keeper — balances, adjustments, transfers',
    permissions: [
      'rxsoft.catalog.item.read',
      'rxsoft.inventory.stock.read',
      'rxsoft.inventory.stock.adjust',
      'rxsoft.inventory.stock.transfer',
    ],
  },
  auditor: {
    name: 'Auditor',
    description: 'Read-only reviewer across the business',
    permissions: [
      'rxsoft.catalog.item.read',
      'rxsoft.sales.sale.read',
      'rxsoft.inventory.stock.read',
      'rxsoft.receivables.transaction.read',
      'rxsoft.reports.*',
      'rxsoft.admin.audit.read',
      'lis.order.read',
      'lis.result.read',
      'conversation.read',
      'communication.read',
      'coding-concept.read',
    ],
  },
  customer: {
    name: 'Customer',
    description: 'Storefront customer',
    permissions: [
      'rxsoft.catalog.item.read',
      'rxsoft.website.content.read',
      'rxsoft.website.orders.read',
      'rxsoft.website.reviews.create',
    ],
  },
  mobile_shopper: {
    name: 'Mobile Shopper',
    description: 'Self-onboarded mobile storefront shopper (phone/OTP)',
    permissions: [],
  },
};

// Which users to create for the organisation (usernames are namespaced:
// <ORGCODE>_<SUFFIX>). Kept small for the POS/orders/purchases workflows.
export interface UserTemplate {
  suffix: string;
  roles: string[];
  locationCode: string;
}

export const ORG_TEMPLATE_USERS: UserTemplate[] = [
  { suffix: 'OWNER', roles: ['admin'], locationCode: 'STORE' },
  { suffix: 'CASHIER', roles: ['cashier'], locationCode: 'STORE' },
  { suffix: 'PHARMACIST', roles: ['pharmacist'], locationCode: 'STORE' },
  { suffix: 'PHARMACIST_ASSISTANT', roles: ['pharmacist_assistant'], locationCode: 'STORE' },
];

export const LOCATION_HQ_CODE = 'HQ';
export const LOCATION_HQ_NAME = 'Headquarters';
export const LOCATION_STORE_SUFFIX = 'STORE';

// Default EMR departments provisioned at a new organisation's HQ site
// (written to the emr database).
export interface DepartmentTemplate {
  code: string;
  name: string;
  type: string;
  description: string;
}

export const DEFAULT_ORG_DEPARTMENTS: DepartmentTemplate[] = [
  { code: 'OUTPATIENT', name: 'Outpatient Department', type: 'OPD', description: 'General outpatient clinic and consultations' },
  { code: 'INPATIENT', name: 'Inpatient (Wards)', type: 'INPATIENT', description: 'Inpatient wards and nursing units' },
  { code: 'EMERGENCY', name: 'Emergency Department', type: 'EMERGENCY', description: 'Accident and emergency care' },
  { code: 'LABORATORY', name: 'Laboratory', type: 'LABORATORY', description: 'Clinical laboratory services' },
  { code: 'PHARMACY', name: 'Pharmacy', type: 'PHARMACY', description: 'Main dispensary and pharmacy services' },
  { code: 'RADIOLOGY', name: 'Radiology', type: 'RADIOLOGY', description: 'Imaging and radiology services' },
  { code: 'MATERNITY', name: 'Maternity', type: 'MATERNITY', description: 'Antenatal, delivery and postnatal care' },
];

// Provisioned organisations price/stock EVERY whitelisted item: retail prices
// are read from resources/price_list_items.json (optional generated mirror,
// empty by default) with a deterministic fallback, and opening stock/cost are
// derived. See provision.service.ts (loadRetailPrices / retailFor / openingFor).

export const RETAIL_PRICE_LIST_CODE = 'RETAIL';
