import { ModuleInfoDto } from '../dto/module-info.dto';

export const AVAILABLE_MODULES: ModuleInfoDto[] = [
  { id: 'rxsoft', name: 'RxSoft', description: 'Pharmacy Admin', root: '/items' },
  { id: 'conversation', name: 'Conversation', description: 'Workflow Chat', root: '/conversations' },
  { id: 'communication', name: 'Switch', description: 'Messaging & Routing', root: '/messages' },
  { id: 'coding-concept', name: 'Coding Concept', description: 'Terminology', root: '/coding-concepts' },
  { id: 'lis', name: 'LIS', description: 'Laboratory', root: '/lis' },
  { id: 'admin', name: 'Admin Console', description: 'Administration', root: '/users' },
  { id: 'website', name: 'Website Console', description: 'Website', root: '/damorex' },
];

export function getUserModules(permissions: string[], roleCodes: string[] = []): ModuleInfoDto[] {
  if (roleCodes.includes('super_admin')) {
    return AVAILABLE_MODULES;
  }

  return AVAILABLE_MODULES.filter((mod) => {
    return permissions.some(
      (perm) => perm.startsWith(mod.id + '.') || perm === mod.id || perm.includes('.' + mod.id + '.'),
    );
  });
}
