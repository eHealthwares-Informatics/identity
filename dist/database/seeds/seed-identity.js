"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedIdentity = seedIdentity;
const node_crypto_1 = require("node:crypto");
const user_orm_entity_1 = require("../../modules/users/entities/user.orm-entity");
const role_orm_entity_1 = require("../../modules/roles/entities/role.orm-entity");
const permission_orm_entity_1 = require("../../modules/roles/entities/permission.orm-entity");
const organization_orm_entity_1 = require("../../modules/organizations/entities/organization.orm-entity");
const location_orm_entity_1 = require("../../modules/locations/entities/location.orm-entity");
const ORG_ID = 'df3b4afd-9955-4617-9a82-264cc73dd8b2';
function hash(password) {
    return (0, node_crypto_1.createHash)('sha256').update(password).digest('hex');
}
async function seedIdentity(dataSource) {
    const orgRepo = dataSource.getRepository(organization_orm_entity_1.OrganizationOrmEntity);
    const locRepo = dataSource.getRepository(location_orm_entity_1.LocationOrmEntity);
    const permRepo = dataSource.getRepository(permission_orm_entity_1.PermissionOrmEntity);
    const roleRepo = dataSource.getRepository(role_orm_entity_1.RoleOrmEntity);
    const userRepo = dataSource.getRepository(user_orm_entity_1.UserOrmEntity);
    let org = await orgRepo.findOne({ where: { id: ORG_ID } });
    if (!org) {
        org = orgRepo.create({ id: ORG_ID, code: 'DEFAULT_ORG', name: 'Default Organization', isActive: true });
        await orgRepo.save(org);
        console.log('Created default organization');
    }
    const locations = [
        { code: 'HQ', name: 'Headquarters' },
        { code: 'CLINIC-A', name: 'Clinic A' },
        { code: 'CLINIC-B', name: 'Clinic B' },
        { code: 'PHARMACY', name: 'Main Pharmacy' },
        { code: 'LAB', name: 'Laboratory' },
    ];
    for (const loc of locations) {
        const exists = await locRepo.findOne({ where: { organizationId: ORG_ID, code: loc.code } });
        if (!exists) {
            await locRepo.save(locRepo.create({ organizationId: ORG_ID, code: loc.code, name: loc.name, isActive: true }));
            console.log(`Created location: ${loc.code}`);
        }
    }
    const allPerms = [
        { code: '*', resource: '*', action: '*', description: 'Full system access' },
        { code: 'rxsoft.*', resource: '*', action: '*', description: 'All RxSoft permissions' },
        { code: 'rxsoft.catalog.*', resource: '*', action: '*', description: 'All catalog permissions' },
        { code: 'rxsoft.sales.*', resource: '*', action: '*', description: 'All sales permissions' },
        { code: 'rxsoft.inventory.*', resource: '*', action: '*', description: 'All inventory permissions' },
        { code: 'rxsoft.purchases.*', resource: '*', action: '*', description: 'All purchases permissions' },
        { code: 'rxsoft.receivables.*', resource: '*', action: '*', description: 'All receivables permissions' },
        { code: 'rxsoft.reports.*', resource: '*', action: '*', description: 'All reports permissions' },
        { code: 'rxsoft.identity.*', resource: '*', action: '*', description: 'All identity permissions' },
        { code: 'rxsoft.admin.*', resource: '*', action: '*', description: 'All admin permissions' },
        { code: 'rxsoft.website.*', resource: '*', action: '*', description: 'All website permissions' },
        { code: 'lis.*', resource: '*', action: '*', description: 'All LIS permissions' },
        { code: 'conversation.*', resource: '*', action: '*', description: 'All conversation permissions' },
        { code: 'communication.*', resource: '*', action: '*', description: 'All communication permissions' },
        { code: 'coding-concept.*', resource: '*', action: '*', description: 'All coding concept permissions' },
        { code: 'rxsoft.identity.user.create', resource: 'user', action: 'create', description: 'Create users' },
        { code: 'rxsoft.identity.user.read', resource: 'user', action: 'read', description: 'Read users' },
        { code: 'rxsoft.identity.user.update', resource: 'user', action: 'update', description: 'Update users' },
        { code: 'rxsoft.identity.user.delete', resource: 'user', action: 'delete', description: 'Delete users' },
        { code: 'rxsoft.identity.role.create', resource: 'role', action: 'create', description: 'Create roles' },
        { code: 'rxsoft.identity.role.read', resource: 'role', action: 'read', description: 'Read roles' },
        { code: 'rxsoft.identity.role.update', resource: 'role', action: 'update', description: 'Update roles' },
        { code: 'rxsoft.identity.role.delete', resource: 'role', action: 'delete', description: 'Delete roles' },
        { code: 'rxsoft.identity.auth.login', resource: 'auth', action: 'login', description: 'Login' },
        { code: 'rxsoft.catalog.item.create', resource: 'item', action: 'create', description: 'Create items' },
        { code: 'rxsoft.catalog.item.read', resource: 'item', action: 'read', description: 'Read items' },
        { code: 'rxsoft.catalog.item.update', resource: 'item', action: 'update', description: 'Update items' },
        { code: 'rxsoft.catalog.item.delete', resource: 'item', action: 'delete', description: 'Delete items' },
        { code: 'rxsoft.sales.sale.create', resource: 'sale', action: 'create', description: 'Create sales' },
        { code: 'rxsoft.sales.sale.read', resource: 'sale', action: 'read', description: 'Read sales' },
        { code: 'rxsoft.sales.sale.refund', resource: 'sale', action: 'refund', description: 'Process refunds' },
        { code: 'rxsoft.sales.sale.update', resource: 'sale', action: 'update', description: 'Update sales' },
        { code: 'rxsoft.inventory.stock.read', resource: 'stock', action: 'read', description: 'Read stock' },
        { code: 'rxsoft.inventory.stock.adjust', resource: 'stock', action: 'adjust', description: 'Adjust stock' },
        { code: 'rxsoft.inventory.stock.transfer', resource: 'stock', action: 'transfer', description: 'Transfer stock' },
        { code: 'rxsoft.purchases.order.create', resource: 'purchase_order', action: 'create', description: 'Create POs' },
        { code: 'rxsoft.purchases.order.read', resource: 'purchase_order', action: 'read', description: 'Read POs' },
        { code: 'rxsoft.purchases.order.update', resource: 'purchase_order', action: 'update', description: 'Update POs' },
        { code: 'rxsoft.receivables.transaction.create', resource: 'receivable', action: 'create', description: 'Record receivables' },
        { code: 'rxsoft.receivables.transaction.read', resource: 'receivable', action: 'read', description: 'Read receivables' },
        { code: 'rxsoft.admin.audit.read', resource: 'audit', action: 'read', description: 'Read audit logs' },
        { code: 'rxsoft.admin.settings.read', resource: 'settings', action: 'read', description: 'Read settings' },
        { code: 'rxsoft.admin.settings.update', resource: 'settings', action: 'update', description: 'Update settings' },
        { code: 'rxsoft.website.content.read', resource: 'website_content', action: 'read', description: 'Read website content' },
        { code: 'rxsoft.website.content.create', resource: 'website_content', action: 'create', description: 'Create website content' },
        { code: 'rxsoft.website.content.manage', resource: 'website_content', action: 'manage', description: 'Manage website content' },
        { code: 'rxsoft.website.prescriptions.create', resource: 'prescription', action: 'create', description: 'Create prescriptions' },
        { code: 'rxsoft.website.prescriptions.read', resource: 'prescription', action: 'read', description: 'Read prescriptions' },
        { code: 'rxsoft.website.orders.create', resource: 'website_order', action: 'create', description: 'Create website orders' },
        { code: 'rxsoft.website.orders.read', resource: 'website_order', action: 'read', description: 'Read website orders' },
        { code: 'rxsoft.website.consultations.create', resource: 'consultation', action: 'create', description: 'Create consultations' },
        { code: 'rxsoft.website.consultations.read', resource: 'consultation', action: 'read', description: 'Read consultations' },
        { code: 'rxsoft.website.reviews.create', resource: 'review', action: 'create', description: 'Create reviews' },
        { code: 'rxsoft.website.rewards.read', resource: 'reward', action: 'read', description: 'Read rewards' },
        { code: 'lis.order.create', resource: 'lis_order', action: 'create', description: 'Create lab orders' },
        { code: 'lis.order.read', resource: 'lis_order', action: 'read', description: 'Read lab orders' },
        { code: 'lis.result.create', resource: 'lis_result', action: 'create', description: 'Enter results' },
        { code: 'lis.result.read', resource: 'lis_result', action: 'read', description: 'Read results' },
        { code: 'lis.result.finalize', resource: 'lis_result', action: 'finalize', description: 'Finalize results' },
        { code: 'lis.order.update', resource: 'lis_order', action: 'update', description: 'Update lab orders' },
        { code: 'conversation.read', resource: 'conversation', action: 'read', description: 'Read conversations' },
        { code: 'conversation.create', resource: 'conversation', action: 'create', description: 'Create conversations' },
        { code: 'conversation.manage', resource: 'conversation', action: 'manage', description: 'Manage conversations' },
        { code: 'communication.read', resource: 'communication', action: 'read', description: 'Read communications' },
        { code: 'communication.create', resource: 'communication', action: 'create', description: 'Create communications' },
        { code: 'communication.manage', resource: 'communication', action: 'manage', description: 'Manage communications' },
        { code: 'coding-concept.read', resource: 'coding_concept', action: 'read', description: 'Read coding concepts' },
        { code: 'coding-concept.create', resource: 'coding_concept', action: 'create', description: 'Create coding concepts' },
        { code: 'coding-concept.manage', resource: 'coding_concept', action: 'manage', description: 'Manage coding concepts' },
    ];
    const permEntities = [];
    for (const p of allPerms) {
        let perm = await permRepo.findOne({ where: { code: p.code } });
        if (!perm) {
            perm = permRepo.create({ code: p.code, resource: p.resource, action: p.action, description: p.description });
            perm = await permRepo.save(perm);
        }
        permEntities.push(perm);
    }
    console.log(`Seeded ${permEntities.length} permissions`);
    const byCode = (code) => permEntities.filter(p => p.code === code);
    const byPrefix = (prefix) => permEntities.filter(p => p.code.startsWith(prefix));
    const byIncludes = (sub) => permEntities.filter(p => p.code.includes(sub));
    const roleDefs = [
        { code: 'super_admin', name: 'Super Admin', description: 'Full system access', permissions: permEntities },
        { code: 'admin', name: 'Admin', description: 'Administrative access', permissions: [
                ...byPrefix('rxsoft.'),
                ...byPrefix('lis.'),
                ...byPrefix('conversation.'),
                ...byPrefix('communication.'),
                ...byPrefix('coding-concept.'),
            ] },
        { code: 'cashier', name: 'Cashier', description: 'Point of sale', permissions: byCode('rxsoft.catalog.item.read').concat(byCode('rxsoft.sales.sale.create'), byCode('rxsoft.sales.sale.read'), byCode('rxsoft.inventory.stock.read')) },
        { code: 'auditor', name: 'Auditor', description: 'Read-only access', permissions: byIncludes('.read') },
        { code: 'customer', name: 'Customer', description: 'Self-service portal', permissions: byCode('rxsoft.catalog.item.read').concat(byCode('rxsoft.sales.sale.create')) },
        { code: 'website_user', name: 'Website User', description: 'Website portal user', permissions: byPrefix('rxsoft.website.') },
        { code: 'lis_technician', name: 'LIS Technician', description: 'Laboratory operations', permissions: byPrefix('lis.') },
        { code: 'conversation_operator', name: 'Conversation Operator', description: 'Manages conversations', permissions: byPrefix('conversation.') },
        { code: 'communication_manager', name: 'Communication Manager', description: 'Manages communications', permissions: byPrefix('communication.') },
        { code: 'coding_concept_editor', name: 'Coding Concept Editor', description: 'Manages coding concepts', permissions: byPrefix('coding-concept.') },
        { code: 'admin_operator', name: 'Admin Operator', description: 'System administration', permissions: byPrefix('rxsoft.admin.') },
        { code: 'website_manager', name: 'Website Manager', description: 'Full website management', permissions: byPrefix('rxsoft.website.').concat(byCode('rxsoft.admin.settings.read')) },
    ];
    for (const rd of roleDefs) {
        let role = await roleRepo.findOne({ where: { organizationId: ORG_ID, code: rd.code } });
        if (!role) {
            role = roleRepo.create({ organizationId: ORG_ID, code: rd.code, name: rd.name, description: rd.description, permissions: rd.permissions });
            await roleRepo.save(role);
            console.log(`Created role: ${rd.code}`);
        }
    }
    const labLocation = await locRepo.findOne({ where: { organizationId: ORG_ID, code: 'LAB' } });
    const locId = labLocation?.id ?? null;
    const users = [
        { username: 'super_admin', roleCodes: ['super_admin'], orgId: null, locationId: null },
        { username: 'admin', roleCodes: ['admin'], orgId: ORG_ID, locationId: null },
        { username: 'cashier', roleCodes: ['cashier'], orgId: ORG_ID, locationId: null },
        { username: 'auditor', roleCodes: ['auditor'], orgId: ORG_ID, locationId: null },
        { username: 'customer', roleCodes: ['customer'], orgId: ORG_ID, locationId: null },
        { username: 'website_user', roleCodes: ['website_user'], orgId: ORG_ID, locationId: null },
        { username: 'lis_technician', roleCodes: ['lis_technician'], orgId: ORG_ID, locationId: locId },
        { username: 'conversation_operator', roleCodes: ['conversation_operator'], orgId: ORG_ID, locationId: null },
        { username: 'communication_manager', roleCodes: ['communication_manager'], orgId: ORG_ID, locationId: null },
        { username: 'coding_concept_editor', roleCodes: ['coding_concept_editor'], orgId: ORG_ID, locationId: null },
        { username: 'admin_operator', roleCodes: ['admin_operator'], orgId: ORG_ID, locationId: null },
        { username: 'website_manager', roleCodes: ['website_manager'], orgId: ORG_ID, locationId: null },
    ];
    for (const u of users) {
        const existing = await userRepo.findOne({ where: { username: u.username } });
        if (!existing) {
            const userOrgId = u.orgId;
            const roleEntities = await roleRepo.find({ where: u.roleCodes.map(c => ({ organizationId: userOrgId ?? ORG_ID, code: c })) });
            const entity = userRepo.create({
                organizationId: userOrgId,
                locationId: u.locationId,
                username: u.username,
                passwordHash: hash('password'),
                isActive: true,
                roles: roleEntities,
            });
            await userRepo.save(entity);
            console.log(`Created user: ${u.username}`);
        }
    }
    console.log('Seed complete: all users and roles with wildcard-based permissions');
}
//# sourceMappingURL=seed-identity.js.map