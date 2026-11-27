import { describe, expect, it } from 'vitest';
import { ACTIONS, can, isRole, ROLES } from '../../shared/auth/roles';

describe('role permissions', () => {
  it('owner can do everything', () => {
    for (const action of ACTIONS) expect(can('owner', action)).toBe(true);
  });

  it('admin cannot manage the organisation itself', () => {
    expect(can('admin', 'org.manage')).toBe(false);
    expect(can('admin', 'members.manage')).toBe(true);
    expect(can('admin', 'audit.read')).toBe(true);
  });

  it('teacher writes content but cannot manage members or audit', () => {
    expect(can('teacher', 'project.write')).toBe(true);
    expect(can('teacher', 'board.write')).toBe(true);
    expect(can('teacher', 'members.manage')).toBe(false);
    expect(can('teacher', 'audit.read')).toBe(false);
  });

  it('student can read and write boards only', () => {
    expect(can('student', 'board.read')).toBe(true);
    expect(can('student', 'board.write')).toBe(true);
    expect(can('student', 'project.write')).toBe(false);
    expect(can('student', 'board.delete')).toBe(false);
    expect(can('student', 'library.write')).toBe(false);
    expect(can('student', 'storage.write')).toBe(false);
  });

  it('validates role names', () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true);
    expect(isRole('superadmin')).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
