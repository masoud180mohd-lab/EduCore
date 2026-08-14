import { describe, expect, it } from 'vitest';

import { visibleWorkspaces, workspaceFromPath, workspaceHref } from './workspace.js';

describe('workspaceFromPath', () => {
  it('detects teacher, parent, and office', () => {
    expect(workspaceFromPath('/t/x/teacher/marks')).toBe('teacher');
    expect(workspaceFromPath('/t/x/parent')).toBe('parent');
    expect(workspaceFromPath('/t/x/admin/fees')).toBe('office');
  });
});

describe('visibleWorkspaces', () => {
  it('lets owner preview office, teacher, and parent', () => {
    expect(visibleWorkspaces({ roles: [{ code: 'owner' }], permissions: [] })).toEqual([
      'office',
      'teacher',
      'parent',
    ]);
  });

  it('keeps bursar on office only', () => {
    expect(
      visibleWorkspaces({
        roles: [{ code: 'bursar' }],
        permissions: ['finance.read', 'finance.manage'],
      }),
    ).toEqual(['office']);
  });

  it('shows teacher for classroom staff', () => {
    expect(
      visibleWorkspaces({
        roles: [{ code: 'staff' }],
        permissions: ['attendance.manage'],
      }),
    ).toEqual(['teacher']);
  });

  it('shows parent only for parent role', () => {
    expect(
      visibleWorkspaces({
        roles: [{ code: 'parent' }],
        permissions: ['parent.guardian.read'],
      }),
    ).toEqual(['parent']);
  });
});

describe('workspaceHref', () => {
  it('builds tenant paths', () => {
    expect(workspaceHref('t1', 'office')).toBe('/t/t1/admin');
    expect(workspaceHref('t1', 'teacher')).toBe('/t/t1/teacher');
    expect(workspaceHref('t1', 'parent')).toBe('/t/t1/parent');
  });
});
