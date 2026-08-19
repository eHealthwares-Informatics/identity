export interface ModulePermissionDefinition {
  module: string;
  moduleDisplayName: string;
  permissions: Array<{
    code: string;
    name: string;
    description: string;
    resource: string;
    action: string;
  }>;
}

export const MODULE_PERMISSIONS: ModulePermissionDefinition[] = [
  {
    module: 'rxsoft.identity',
    moduleDisplayName: 'Identity & Access',
    permissions: [
      { code: 'rxsoft.identity.user.create', name: 'Create User', description: 'Create new user accounts', resource: 'user', action: 'create' },
      { code: 'rxsoft.identity.user.read', name: 'Read User', description: 'View user details', resource: 'user', action: 'read' },
      { code: 'rxsoft.identity.user.update', name: 'Update User', description: 'Modify user accounts', resource: 'user', action: 'update' },
      { code: 'rxsoft.identity.user.delete', name: 'Delete User', description: 'Remove user accounts', resource: 'user', action: 'delete' },
      { code: 'rxsoft.identity.role.create', name: 'Create Role', description: 'Create new roles', resource: 'role', action: 'create' },
      { code: 'rxsoft.identity.role.read', name: 'Read Role', description: 'View role details', resource: 'role', action: 'read' },
      { code: 'rxsoft.identity.role.update', name: 'Update Role', description: 'Modify roles', resource: 'role', action: 'update' },
      { code: 'rxsoft.identity.role.delete', name: 'Delete Role', description: 'Delete roles', resource: 'role', action: 'delete' },
      { code: 'rxsoft.identity.auth.login', name: 'Login', description: 'Authenticate', resource: 'auth', action: 'login' },
    ],
  },
  {
    module: 'rxsoft.catalog',
    moduleDisplayName: 'Catalog',
    permissions: [
      { code: 'rxsoft.catalog.item.create', name: 'Create Item', description: 'Create new items', resource: 'item', action: 'create' },
      { code: 'rxsoft.catalog.item.read', name: 'Read Item', description: 'View items', resource: 'item', action: 'read' },
      { code: 'rxsoft.catalog.item.update', name: 'Update Item', description: 'Modify items', resource: 'item', action: 'update' },
      { code: 'rxsoft.catalog.item.delete', name: 'Delete Item', description: 'Delete items', resource: 'item', action: 'delete' },
    ],
  },
  {
    module: 'rxsoft.sales',
    moduleDisplayName: 'Sales',
    permissions: [
      { code: 'rxsoft.sales.sale.create', name: 'Create Sale', description: 'Create new sales', resource: 'sale', action: 'create' },
      { code: 'rxsoft.sales.sale.read', name: 'Read Sale', description: 'View sales', resource: 'sale', action: 'read' },
      { code: 'rxsoft.sales.sale.update', name: 'Update Sale', description: 'Modify sales', resource: 'sale', action: 'update' },
      { code: 'rxsoft.sales.sale.refund', name: 'Create Refund', description: 'Process refunds', resource: 'sale', action: 'refund' },
    ],
  },
  {
    module: 'rxsoft.inventory',
    moduleDisplayName: 'Inventory',
    permissions: [
      { code: 'rxsoft.inventory.stock.read', name: 'Read Stock', description: 'View stock balances', resource: 'stock', action: 'read' },
      { code: 'rxsoft.inventory.stock.adjust', name: 'Adjust Stock', description: 'Adjust stock quantities', resource: 'stock', action: 'adjust' },
      { code: 'rxsoft.inventory.stock.transfer', name: 'Transfer Stock', description: 'Transfer between locations', resource: 'stock', action: 'transfer' },
    ],
  },
  {
    module: 'rxsoft.purchases',
    moduleDisplayName: 'Purchases',
    permissions: [
      { code: 'rxsoft.purchases.order.create', name: 'Create Purchase Order', description: 'Create purchase orders', resource: 'purchase_order', action: 'create' },
      { code: 'rxsoft.purchases.order.read', name: 'Read Purchase Order', description: 'View purchase orders', resource: 'purchase_order', action: 'read' },
      { code: 'rxsoft.purchases.order.update', name: 'Update Purchase Order', description: 'Modify purchase orders', resource: 'purchase_order', action: 'update' },
    ],
  },
  {
    module: 'rxsoft.receivables',
    moduleDisplayName: 'Receivables',
    permissions: [
      { code: 'rxsoft.receivables.transaction.create', name: 'Create Transaction', description: 'Record receivable transactions', resource: 'receivable', action: 'create' },
      { code: 'rxsoft.receivables.transaction.read', name: 'Read Transaction', description: 'View receivable transactions', resource: 'receivable', action: 'read' },
    ],
  },
  {
    module: 'rxsoft.reports',
    moduleDisplayName: 'Reports',
    permissions: [
      { code: 'rxsoft.reports.sales.view', name: 'View Sales Reports', description: 'Access sales reports', resource: 'report', action: 'view' },
      { code: 'rxsoft.reports.inventory.view', name: 'View Inventory Reports', description: 'Access inventory reports', resource: 'report', action: 'view' },
      { code: 'rxsoft.reports.financial.view', name: 'View Financial Reports', description: 'Access financial reports', resource: 'report', action: 'view' },
    ],
  },
  {
    module: 'rxsoft.admin',
    moduleDisplayName: 'Administration',
    permissions: [
      { code: 'rxsoft.admin.audit.read', name: 'Read Audit Logs', description: 'View audit logs', resource: 'audit', action: 'read' },
      { code: 'rxsoft.admin.settings.read', name: 'Read Settings', description: 'View system settings', resource: 'settings', action: 'read' },
      { code: 'rxsoft.admin.settings.update', name: 'Update Settings', description: 'Modify system settings', resource: 'settings', action: 'update' },
    ],
  },
  {
    module: 'rxsoft.website',
    moduleDisplayName: 'Website',
    permissions: [
      { code: 'rxsoft.website.content.read', name: 'Read Content', description: 'View website content', resource: 'content', action: 'read' },
      { code: 'rxsoft.website.content.create', name: 'Create Content', description: 'Create website content', resource: 'content', action: 'create' },
      { code: 'rxsoft.website.content.manage', name: 'Manage Content', description: 'Manage website content', resource: 'content', action: 'manage' },
      { code: 'rxsoft.website.prescriptions.create', name: 'Create Prescription', description: 'Submit prescriptions', resource: 'prescription', action: 'create' },
      { code: 'rxsoft.website.prescriptions.read', name: 'Read Prescriptions', description: 'View prescriptions', resource: 'prescription', action: 'read' },
      { code: 'rxsoft.website.orders.create', name: 'Create Order', description: 'Create website orders', resource: 'order', action: 'create' },
      { code: 'rxsoft.website.orders.read', name: 'Read Orders', description: 'View website orders', resource: 'order', action: 'read' },
      { code: 'rxsoft.website.consultations.create', name: 'Create Consultation', description: 'Start consultations', resource: 'consultation', action: 'create' },
      { code: 'rxsoft.website.consultations.read', name: 'Read Consultations', description: 'View consultations', resource: 'consultation', action: 'read' },
      { code: 'rxsoft.website.reviews.create', name: 'Create Review', description: 'Submit reviews', resource: 'review', action: 'create' },
      { code: 'rxsoft.website.rewards.read', name: 'Read Rewards', description: 'View rewards', resource: 'reward', action: 'read' },
    ],
  },
  {
    module: 'lis',
    moduleDisplayName: 'LIS',
    permissions: [
      { code: 'lis.order.create', name: 'Create Order', description: 'Create lab orders', resource: 'lis_order', action: 'create' },
      { code: 'lis.order.read', name: 'Read Order', description: 'View lab orders', resource: 'lis_order', action: 'read' },
      { code: 'lis.order.update', name: 'Update Order', description: 'Modify lab orders', resource: 'lis_order', action: 'update' },
      { code: 'lis.result.create', name: 'Enter Result', description: 'Enter test results', resource: 'lis_result', action: 'create' },
      { code: 'lis.result.finalize', name: 'Finalize Result', description: 'Approve and finalize results', resource: 'lis_result', action: 'finalize' },
      { code: 'lis.result.read', name: 'Read Result', description: 'View test results', resource: 'lis_result', action: 'read' },
    ],
  },
  {
    module: 'emr',
    moduleDisplayName: 'EMR',
    permissions: [
      { code: 'emr.patient.create', name: 'Create Patient', description: 'Create patient records', resource: 'patient', action: 'create' },
      { code: 'emr.patient.read', name: 'Read Patient', description: 'View patient records', resource: 'patient', action: 'read' },
      { code: 'emr.patient.update', name: 'Update Patient', description: 'Modify patient records', resource: 'patient', action: 'update' },
      { code: 'emr.appointment.create', name: 'Create Appointment', description: 'Schedule appointments', resource: 'appointment', action: 'create' },
      { code: 'emr.appointment.read', name: 'Read Appointment', description: 'View appointments', resource: 'appointment', action: 'read' },
      { code: 'emr.visit.read', name: 'Read Visit', description: 'View patient visits', resource: 'visit', action: 'read' },
      { code: 'emr.encounter.read', name: 'Read Encounter', description: 'View clinical encounters', resource: 'encounter', action: 'read' },
      { code: 'emr.form.read', name: 'Read Form', description: 'View clinical form definitions', resource: 'form', action: 'read' },
      { code: 'emr.request.read', name: 'Read Request', description: 'View clinical requests', resource: 'request', action: 'read' },
    ],
  },
  {
    module: 'conversation',
    moduleDisplayName: 'Conversation',
    permissions: [
      { code: 'conversation.read', name: 'Read Conversations', description: 'View conversations', resource: 'conversation', action: 'read' },
      { code: 'conversation.create', name: 'Create Conversations', description: 'Start new conversations', resource: 'conversation', action: 'create' },
      { code: 'conversation.manage', name: 'Manage Conversations', description: 'Manage conversations', resource: 'conversation', action: 'manage' },
    ],
  },
  {
    module: 'communication',
    moduleDisplayName: 'Switch',
    permissions: [
      { code: 'communication.read', name: 'Read Communications', description: 'View communications', resource: 'communication', action: 'read' },
      { code: 'communication.create', name: 'Create Communications', description: 'Create communications', resource: 'communication', action: 'create' },
      { code: 'communication.manage', name: 'Manage Communications', description: 'Manage communications', resource: 'communication', action: 'manage' },
    ],
  },
  {
    module: 'coding-concept',
    moduleDisplayName: 'Coding Concept',
    permissions: [
      { code: 'coding-concept.read', name: 'Read Coding Concepts', description: 'View coding concepts', resource: 'coding_concept', action: 'read' },
      { code: 'coding-concept.create', name: 'Create Coding Concepts', description: 'Create coding concepts', resource: 'coding_concept', action: 'create' },
      { code: 'coding-concept.manage', name: 'Manage Coding Concepts', description: 'Manage coding concepts', resource: 'coding_concept', action: 'manage' },
    ],
  },
];
