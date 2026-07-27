'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { ResourceList, ResourceListPagination } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import {
  type ClassRow,
  type EnrollmentRow,
  type EnrollmentStatus,
  type StreamRow,
  type StudentOption,
  ENROLLMENT_STATUSES,
  academicMessage,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

const CLASS_PICKER_LIMIT = 100;
const STUDENT_PICKER_LIMIT = 100;

export default function AdminEnrollmentsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [status, setStatus] = useState<EnrollmentStatus>('active');

  async function loadPickers() {
    const auth = readSession();
    if (auth === null) return;
    try {
      const [classRes, studentRes] = await Promise.all([
        apiRequest<{ data: ClassRow[] }>(
          buildListQuery('/api/v1/classes', { limit: CLASS_PICKER_LIMIT }),
          { auth },
        ),
        apiRequest<{ data: StudentOption[] }>(
          buildListQuery('/api/v1/students', {
            limit: STUDENT_PICKER_LIMIT,
            filters: { status: 'active' },
          }),
          { auth },
        ),
      ]);
      const classList = classRes.data ?? [];
      const studentList = studentRes.data ?? [];
      setClasses(classList);
      setStudents(studentList);
      const cMap: Record<string, string> = {};
      for (const c of classList) cMap[c.id] = c.name;
      setClassNames(cMap);
      const sMap: Record<string, string> = {};
      for (const s of studentList) sMap[s.id] = s.displayName;
      setStudentNames(sMap);
    } catch {
      // Picker failure — form/filter still usable if list loaded
    }
  }

  async function loadPage(opts: {
    readonly classFilter: string;
    readonly statusFilter: string;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMore(true);
    else setLoading(true);
    try {
      const q = buildListQuery('/api/v1/enrollments', {
        limit: ADMIN_LIST_DEFAULT_LIMIT,
        cursor: opts.cursor,
        filters: {
          classId: opts.classFilter === '' ? undefined : opts.classFilter,
          status: opts.statusFilter === '' ? undefined : opts.statusFilter,
        },
      });
      const result = await apiRequest<PaginatedEnvelope<EnrollmentRow>>(q, { auth });
      const page = readPageMeta(result);
      setRows((prev) =>
        opts.append ? appendById(prev, result.data ?? []) : [...(result.data ?? [])],
      );
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not load enrollments.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadPickers();
  }, []);

  useEffect(() => {
    void loadPage({
      classFilter: filterClassId,
      statusFilter: filterStatus,
      cursor: null,
      append: false,
    });
  }, [filterClassId, filterStatus]);

  useEffect(() => {
    const auth = readSession();
    if (auth === null || classId === '') {
      setStreams([]);
      return;
    }
    void (async () => {
      try {
        const q = buildListQuery('/api/v1/streams', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          filters: { classId },
        });
        const streamRes = await apiRequest<{ data: StreamRow[] }>(q, { auth });
        setStreams(streamRes.data ?? []);
      } catch {
        setStreams([]);
      }
    })();
  }, [classId]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const auth = readSession();
    if (auth === null || studentId === '' || classId === '') return;
    setBusy(true);
    setError(null);
    const actionKey = `enrollment.create:${studentId}:${classId}`;
    const idem = readOrCreateIdempotencyKey(actionKey);
    try {
      const body: Record<string, string> = { studentId, classId, status };
      if (streamId !== '') body['streamId'] = streamId;
      const created = await apiRequest<{ data: EnrollmentRow }>('/api/v1/enrollments', {
        method: 'POST',
        auth,
        body,
        idempotencyKey: idem,
      });
      clearIdempotencyKey(actionKey);
      setStudentId('');
      setStreamId('');
      router.push(`/t/${tenantId}/admin/academic/enrollments/${created.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) setError(academicMessage(err));
      else setError('Could not create enrollment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin/academic`}>← Academic</Link>
      </p>
      <h1>Enrollments</h1>
      <p className="muted">Place students in classes (ACF-008). Year/term come from the class.</p>
      {error !== null ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="filter-class">Filter by class</label>
        <select
          id="filter-class"
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="filter-status">Filter by status</label>
        <select
          id="filter-status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {ENROLLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Enroll student</h2>
        <div className="field">
          <label htmlFor="enroll-student">Student</label>
          <select
            id="enroll-student"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="enroll-class">Class</label>
          <select
            id="enroll-class"
            required
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setStreamId('');
            }}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="enroll-stream">Stream (optional)</label>
          <select id="enroll-stream" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
            <option value="">None</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="enroll-status">Status</label>
          <select
            id="enroll-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as EnrollmentStatus)}
          >
            {ENROLLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || studentId === '' || classId === ''}
        >
          {busy ? 'Saving…' : 'Create enrollment'}
        </button>
      </form>

      <ResourceList
        loading={loading}
        empty="No enrollments yet."
        isEmpty={rows.length === 0}
        footer={
          <ResourceListPagination
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => {
              void loadPage({
                classFilter: filterClassId,
                statusFilter: filterStatus,
                cursor: nextCursor,
                append: true,
              });
            }}
          />
        }
      >
        {rows.map((row) => (
          <li key={row.id}>
            <Link className="card" href={`/t/${tenantId}/admin/academic/enrollments/${row.id}`}>
              <strong>{studentNames[row.studentId] ?? row.studentId}</strong>
              <div className="muted">
                <span className="chip">{row.status}</span>
                {' · '}
                {classNames[row.classId] ?? row.classId}
              </div>
            </Link>
          </li>
        ))}
      </ResourceList>
    </AdminShell>
  );
}
