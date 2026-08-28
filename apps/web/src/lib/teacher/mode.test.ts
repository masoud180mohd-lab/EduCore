import { describe, expect, it } from 'vitest';

import {
  homeHrefForMode,
  modeFromPathname,
  resolveTeacherMode,
  visibleTeacherModes,
} from './mode.js';

describe('visibleTeacherModes', () => {
  it('shows only class when attendance.manage', () => {
    const modes = visibleTeacherModes({ permissions: ['attendance.manage'] });
    expect([...modes]).toEqual(['class']);
  });

  it('shows only subject when marks.manage', () => {
    const modes = visibleTeacherModes({ permissions: ['marks.manage'] });
    expect([...modes]).toEqual(['subject']);
  });

  it('shows both for staff without listed perms (interim)', () => {
    const modes = visibleTeacherModes({ roles: [{ code: 'staff' }] });
    expect(modes.has('class')).toBe(true);
    expect(modes.has('subject')).toBe(true);
  });
});

describe('resolveTeacherMode', () => {
  const both = new Set(['class', 'subject'] as const);

  it('locks to single visible mode', () => {
    expect(
      resolveTeacherMode({
        visible: new Set(['subject']),
        lastUsed: 'class',
        signals: { openAttendanceToday: true, openMarksWindow: false },
      }),
    ).toBe('subject');
  });

  it('prefers class when only attendance pending', () => {
    expect(
      resolveTeacherMode({
        visible: both,
        lastUsed: 'subject',
        signals: { openAttendanceToday: true, openMarksWindow: false },
      }),
    ).toBe('class');
  });

  it('prefers subject when only marks window open', () => {
    expect(
      resolveTeacherMode({
        visible: both,
        lastUsed: 'class',
        signals: { openAttendanceToday: false, openMarksWindow: true },
      }),
    ).toBe('subject');
  });

  it('uses lastUsed when both pending', () => {
    expect(
      resolveTeacherMode({
        visible: both,
        lastUsed: 'subject',
        signals: { openAttendanceToday: true, openMarksWindow: true },
      }),
    ).toBe('subject');
  });

  it('defaults to class when neither pending and no lastUsed', () => {
    expect(
      resolveTeacherMode({
        visible: both,
        lastUsed: null,
        signals: { openAttendanceToday: false, openMarksWindow: false },
      }),
    ).toBe('class');
  });
});

describe('modeFromPathname / homeHrefForMode', () => {
  it('detects mode from path', () => {
    expect(modeFromPathname('/t/x/teacher/marks')).toBe('subject');
    expect(modeFromPathname('/t/x/teacher/attendance')).toBe('class');
    expect(modeFromPathname('/t/x/teacher')).toBe('class');
  });

  it('builds home href', () => {
    expect(homeHrefForMode('tid', 'class')).toBe('/t/tid/teacher');
    expect(homeHrefForMode('tid', 'subject')).toBe('/t/tid/teacher/marks');
  });
});
