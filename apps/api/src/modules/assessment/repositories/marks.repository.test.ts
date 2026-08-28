import { describe, expect, it, vi } from 'vitest';

import type { Pool, PoolClient, QueryResult } from 'pg';

import { MarksRepository } from './marks.repository.js';

const actorUserId = '01900000-0000-7000-8000-000000000001';
const tenantId = '01900000-0000-7000-8000-0000000000aa';
const examId = '01900000-0000-7000-8000-0000000000e1';
const examSubjectId = '01900000-0000-7000-8000-0000000000f1';
const subjectId = '01900000-0000-7000-8000-0000000000b1';
const studentId = '01900000-0000-7000-8000-000000000002';

function mockPool(handler: (sql: string, params?: unknown[]) => unknown): Pool {
  const client = {
    query: vi.fn((sql: string, params?: unknown[]) => {
      const value = handler(sql, params);
      if (typeof value === 'object' && value !== null && 'rows' in value) {
        return Promise.resolve(value as QueryResult);
      }
      return Promise.resolve({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      } satisfies QueryResult);
    }),
    release: vi.fn(),
  };
  return {
    connect: vi.fn(() => Promise.resolve(client as unknown as PoolClient)),
  } as unknown as Pool;
}

describe('MarksRepository.listReportLinesForExam', () => {
  it('selects approved exam subjects only, scoped to tenant and exam (ACF-011 v1.2)', async () => {
    const sqlLog: string[] = [];
    const pool = mockPool((sql, _params) => {
      sqlLog.push(sql);
      if (sql.includes('FROM marks m')) {
        return {
          rows: [
            {
              student_id: studentId,
              exam_subject_id: examSubjectId,
              subject_id: subjectId,
              max_score: '100',
              exam_subject_status: 'approved',
              score: '72.5',
            },
          ],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });

    const repo = new MarksRepository(pool);
    const lines = await repo.listReportLinesForExam(actorUserId, tenantId, examId);

    const reportSql = sqlLog.find((sql) => sql.includes('FROM marks m'));
    expect(reportSql).toBeDefined();
    expect(reportSql).toContain("es.status = 'approved'");
    expect(reportSql).toContain('m.tenant_id = $1::uuid');
    expect(reportSql).toContain('es.exam_id = $2::uuid');

    expect(lines).toHaveLength(1);
    expect(lines[0]?.maxScore).toBe(100);
    expect(lines[0]?.score).toBe(72.5);
    expect(lines[0]?.examSubjectStatus).toBe('approved');
  });

  it('returns no lines for non-UUID inputs without querying (fail-closed)', async () => {
    const pool = mockPool(() => {
      throw new Error('should not query');
    });
    const repo = new MarksRepository(pool);
    await expect(repo.listReportLinesForExam('not-a-uuid', tenantId, examId)).resolves.toEqual([]);
    await expect(repo.listReportLinesForExam(actorUserId, 'not-a-uuid', examId)).resolves.toEqual(
      [],
    );
    await expect(repo.listReportLinesForExam(actorUserId, tenantId, 'not-a-uuid')).resolves.toEqual(
      [],
    );
  });

  it('returns no lines and fails closed when the database errors', async () => {
    const warn = vi.fn();
    const logger = { info: vi.fn(), warn, error: vi.fn() };
    const pool = mockPool(() => {
      throw new Error('connection refused');
    });
    const repo = new MarksRepository(pool, logger);
    await expect(repo.listReportLinesForExam(actorUserId, tenantId, examId)).resolves.toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('failed closed');
  });
});
