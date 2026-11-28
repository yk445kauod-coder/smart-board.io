export const ROLES = ['owner', 'admin', 'teacher', 'student'] as const;
export type Role = (typeof ROLES)[number];

export const ORG_KINDS = ['platform', 'school', 'center', 'independent', 'shared'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ACTIONS = [
  'org.manage',
  'members.manage',
  'audit.read',
  'project.write',
  'project.delete',
  'board.read',
  'board.write',
  'board.delete',
  'library.write',
  'storage.write',
] as const;
export type Action = (typeof ACTIONS)[number];

const PERMISSIONS: Record<Role, readonly Action[]> = {
  owner: [...ACTIONS],
  admin: ACTIONS.filter((a) => a !== 'org.manage'),
  teacher: ['project.write', 'board.read', 'board.write', 'board.delete', 'library.write', 'storage.write'],
  student: ['board.read', 'board.write'],
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[role].includes(action);
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) throw new Error(`forbidden: ${role} cannot ${action}`);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
