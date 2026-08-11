'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { AdminTable, ResourceList, ResourceListPagination, StatusChip } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { ApiClientError, apiRequest } from '@/lib/api/client';
import { adminFriendlyMessage } from '@/lib/admin/admin-friendly-message';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  appendById,
  buildListQuery,
  readPageMeta,
  type PaginatedEnvelope,
} from '@/lib/admin/list-pagination';
import {
  missingNameIds,
  resolveClassNames,
  resolveStudentNames,
} from '@/lib/admin/resolve-related-names';
import {
  type ClassRow,
  type EnrollmentRow,
  type EnrollmentStatus,
  type StreamRow,
  type StudentOption,
  ENROLLMENT_STATUSES,
} from '@/lib/academic/types';
import { clearIdempotencyKey, readOrCreateIdempotencyKey, readSession } from '@/lib/auth/session';

export default function AdminEnrollmentsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillApplied = useRef(false);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesCursor, setClassesCursor] = useState<string | null>(null);
  const [loadingMoreClasses, setLoadingMoreClasses] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsCursor, setStudentsCursor] = useState<string | null>(null);
  const [loadingMoreStudents, setLoadingMoreStudents] = useState(false);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [streamsCursor, setStreamsCursor] = useState<string | null>(null);
  const [loadingMoreStreams, setLoadingMoreStreams] = useState(false);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const classNamesRef = useRef(classNames);
  classNamesRef.current = classNames;
  const studentNamesRef = useRef(studentNames);
  studentNamesRef.current = studentNames;
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

  async function loadClassPicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreClasses(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<ClassRow>>(
        buildListQuery('/api/v1/classes', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setClasses((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setClassesCursor(page.nextCursor);
      setClassNames((prev) => {
        const next = opts.append ? { ...prev } : {};
        for (const c of list) next[c.id] = c.name;
        return next;
      });
    } catch {
      if (!opts.append) {
        setClasses([]);
        setClassesCursor(null);
      }
    } finally {
      setLoadingMoreClasses(false);
    }
  }

  async function loadStudentPicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreStudents(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<StudentOption>>(
        buildListQuery('/api/v1/students', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
          filters: { status: 'active' },
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setStudents((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setStudentsCursor(page.nextCursor);
      setStudentNames((prev) => {
        const next = opts.append ? { ...prev } : {};
        for (const s of list) next[s.id] = s.displayName;
        return next;
      });
    } catch {
      if (!opts.append) {
        setStudents([]);
        setStudentsCursor(null);
      }
    } finally {
      setLoadingMoreStudents(false);
    }
  }

  async function loadStreamPicker(opts: {
    readonly forClassId: string;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null || opts.forClassId === '') {
      setStreams([]);
      setStreamsCursor(null);
      return;
    }
    if (opts.append) setLoadingMoreStreams(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<StreamRow>>(
        buildListQuery('/api/v1/streams', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
          filters: { classId: opts.forClassId },
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setStreams((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setStreamsCursor(page.nextCursor);
    } catch {
      if (!opts.append) {
        setStreams([]);
        setStreamsCursor(null);
      }
    } finally {
      setLoadingMoreStreams(false);
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
      const list = result.data ?? [];
      setRows((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setNextCursor(page.nextCursor);
      setError(null);
      const missStudents = missingNameIds(
        list.map((r) => r.studentId),
        studentNamesRef.current,
      );
      const missClasses = missingNameIds(
        list.map((r) => r.classId),
        classNamesRef.current,
      );
      if (missStudents.length > 0) {
        const names = await resolveStudentNames(auth, missStudents);
        setStudentNames((prev) => ({ ...prev, ...names }));
      }
      if (missClasses.length > 0) {
        const names = await resolveClassNames(auth, missClasses);
        setClassNames((prev) => ({ ...prev, ...names }));
      }
    } catch (err) {
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
      else setError('Could not load enrollments.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadClassPicker({ cursor: null, append: false });
    void loadStudentPicker({ cursor: null, append: false });
  }, []);

  useEffect(() => {
    if (prefillApplied.current) return;
    const raw = searchParams.get('studentId')?.trim() ?? '';
    if (raw === '') return;
    prefillApplied.current = true;
    setStudentId(raw);
    void (async () => {
      const auth = readSession();
      if (auth === null) return;
      try {
        const st = await apiRequest<{ data: StudentOption }>(`/api/v1/students/${raw}`, {
          auth,
        });
        setStudents((prev) => appendById(prev, [st.data]));
        setStudentNames((prev) => ({ ...prev, [st.data.id]: st.data.displayName }));
      } catch {
        /* select still holds UUID until picker catches up */
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    void loadPage({
      classFilter: filterClassId,
      statusFilter: filterStatus,
      cursor: null,
      append: false,
    });
  }, [filterClassId, filterStatus]);

  useEffect(() => {
    setStreamId('');
    void loadStreamPicker({ forClassId: classId, cursor: null, append: false });
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
      if (err instanceof ApiClientError) setError(adminFriendlyMessage(err, 'academic'));
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
        <ResourceListPagination
          nextCursor={classesCursor}
          loadingMore={loadingMoreClasses}
          onLoadMore={() => {
            void loadClassPicker({ cursor: classesCursor, append: true });
          }}
        />
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
          <ResourceListPagination
            nextCursor={studentsCursor}
            loadingMore={loadingMoreStudents}
            onLoadMore={() => {
              void loadStudentPicker({ cursor: studentsCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="enroll-class">Class</label>
          <select
            id="enroll-class"
            required
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
            }}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={classesCursor}
            loadingMore={loadingMoreClasses}
            onLoadMore={() => {
              void loadClassPicker({ cursor: classesCursor, append: true });
            }}
          />
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
          <ResourceListPagination
            nextCursor={streamsCursor}
            loadingMore={loadingMoreStreams}
            onLoadMore={() => {
              void loadStreamPicker({
                forClassId: classId,
                cursor: streamsCursor,
                append: true,
              });
            }}
          />
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
        variant="table"
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
        <AdminTable caption="Enrollments" headers={['Student', 'Class', 'Status', '']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/t/${tenantId}/admin/academic/enrollments/${row.id}`}>
                  {studentNames[row.studentId] ?? row.studentId}
                </Link>
              </td>
              <td className="muted">{classNames[row.classId] ?? row.classId}</td>
              <td>
                <StatusChip label={row.status} />
              </td>
              <td className="admin-table-actions">
                <Link
                  className="btn btn-secondary admin-table-open"
                  href={`/t/${tenantId}/admin/academic/enrollments/${row.id}`}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </AdminTable>
      </ResourceList>
    </AdminShell>
  );
}
