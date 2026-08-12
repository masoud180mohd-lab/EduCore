'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import {
  AdminPageHeader,
  AdminTable,
  Banner,
  ResourceList,
  ResourceListPagination,
  StatusChip,
} from '@/components/admin';
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
  type AcademicYearRow,
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
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [yearsCursor, setYearsCursor] = useState<string | null>(null);
  const [loadingMoreYears, setLoadingMoreYears] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classesCursor, setClassesCursor] = useState<string | null>(null);
  const [loadingMoreClasses, setLoadingMoreClasses] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsCursor, setStudentsCursor] = useState<string | null>(null);
  const [loadingMoreStudents, setLoadingMoreStudents] = useState(false);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [streamsCursor, setStreamsCursor] = useState<string | null>(null);
  const [loadingMoreStreams, setLoadingMoreStreams] = useState(false);
  const [filterStreams, setFilterStreams] = useState<StreamRow[]>([]);
  const [filterStreamsCursor, setFilterStreamsCursor] = useState<string | null>(null);
  const [loadingMoreFilterStreams, setLoadingMoreFilterStreams] = useState(false);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const classNamesRef = useRef(classNames);
  classNamesRef.current = classNames;
  const studentNamesRef = useRef(studentNames);
  studentNamesRef.current = studentNames;
  const [yearFilter, setYearFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [streamFilter, setStreamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | EnrollmentStatus>('');
  const [appliedYearId, setAppliedYearId] = useState('');
  const [appliedStudentId, setAppliedStudentId] = useState('');
  const [appliedClassId, setAppliedClassId] = useState('');
  const [appliedStreamId, setAppliedStreamId] = useState('');
  const [appliedStatus, setAppliedStatus] = useState<'' | EnrollmentStatus>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [status, setStatus] = useState<EnrollmentStatus>('active');

  async function loadYearPicker(opts: {
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null) return;
    if (opts.append) setLoadingMoreYears(true);
    try {
      const result = await apiRequest<PaginatedEnvelope<AcademicYearRow>>(
        buildListQuery('/api/v1/academic-years', {
          limit: ADMIN_LIST_DEFAULT_LIMIT,
          cursor: opts.cursor,
        }),
        { auth },
      );
      const page = readPageMeta(result);
      const list = result.data ?? [];
      setYears((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setYearsCursor(page.nextCursor);
    } catch {
      if (!opts.append) {
        setYears([]);
        setYearsCursor(null);
      }
    } finally {
      setLoadingMoreYears(false);
    }
  }

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

  async function loadFilterStreamPicker(opts: {
    readonly forClassId: string;
    readonly cursor: string | null;
    readonly append: boolean;
  }) {
    const auth = readSession();
    if (auth === null || opts.forClassId === '') {
      setFilterStreams([]);
      setFilterStreamsCursor(null);
      return;
    }
    if (opts.append) setLoadingMoreFilterStreams(true);
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
      setFilterStreams((prev) => (opts.append ? appendById(prev, list) : [...list]));
      setFilterStreamsCursor(page.nextCursor);
    } catch {
      if (!opts.append) {
        setFilterStreams([]);
        setFilterStreamsCursor(null);
      }
    } finally {
      setLoadingMoreFilterStreams(false);
    }
  }

  async function loadPage(opts: {
    readonly yearIdQ: string;
    readonly studentIdQ: string;
    readonly classFilter: string;
    readonly streamIdQ: string;
    readonly statusFilter: '' | EnrollmentStatus;
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
          academicYearId: opts.yearIdQ === '' ? undefined : opts.yearIdQ,
          studentId: opts.studentIdQ === '' ? undefined : opts.studentIdQ,
          classId: opts.classFilter === '' ? undefined : opts.classFilter,
          streamId: opts.streamIdQ === '' ? undefined : opts.streamIdQ,
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
    void loadYearPicker({ cursor: null, append: false });
    void loadClassPicker({ cursor: null, append: false });
    void loadStudentPicker({ cursor: null, append: false });
    void loadPage({
      yearIdQ: '',
      studentIdQ: '',
      classFilter: '',
      streamIdQ: '',
      statusFilter: '',
      cursor: null,
      append: false,
    });
  }, []);

  useEffect(() => {
    if (prefillApplied.current) return;
    const raw = searchParams.get('studentId')?.trim() ?? '';
    if (raw === '') return;
    prefillApplied.current = true;
    setStudentId(raw);
    setStudentFilter(raw);
    setAppliedStudentId(raw);
    void loadPage({
      yearIdQ: '',
      studentIdQ: raw,
      classFilter: '',
      streamIdQ: '',
      statusFilter: '',
      cursor: null,
      append: false,
    });
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
    setStreamId('');
    void loadStreamPicker({ forClassId: classId, cursor: null, append: false });
  }, [classId]);

  useEffect(() => {
    setStreamFilter('');
    void loadFilterStreamPicker({ forClassId: classFilter, cursor: null, append: false });
  }, [classFilter]);

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
      <AdminPageHeader
        title="Enrollments"
        description="Place students in classes. Filter by year, student, class, stream, and status."
      />
      {error !== null ? <Banner tone="error">{error}</Banner> : null}

      <form className="stack card" onSubmit={(e) => void onCreate(e)}>
        <h2 className="section-title">Enroll student</h2>
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

      <form
        className="stack"
        style={{ marginTop: '1.5rem' }}
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedYearId(yearFilter);
          setAppliedStudentId(studentFilter);
          setAppliedClassId(classFilter);
          setAppliedStreamId(streamFilter);
          setAppliedStatus(statusFilter);
          void loadPage({
            yearIdQ: yearFilter,
            studentIdQ: studentFilter,
            classFilter,
            streamIdQ: streamFilter,
            statusFilter,
            cursor: null,
            append: false,
          });
        }}
      >
        <div className="field">
          <label htmlFor="filter-year">Academic year</label>
          <select
            id="filter-year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <ResourceListPagination
            nextCursor={yearsCursor}
            loadingMore={loadingMoreYears}
            onLoadMore={() => {
              void loadYearPicker({ cursor: yearsCursor, append: true });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-student">Student</label>
          <select
            id="filter-student"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
          >
            <option value="">All students</option>
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
          <label htmlFor="filter-class">Class</label>
          <select
            id="filter-class"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
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
          <label htmlFor="filter-stream">Stream</label>
          <select
            id="filter-stream"
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
            disabled={classFilter === ''}
          >
            <option value="">{classFilter === '' ? 'Select a class first' : 'All streams'}</option>
            {filterStreams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {classFilter !== '' ? (
            <ResourceListPagination
              nextCursor={filterStreamsCursor}
              loadingMore={loadingMoreFilterStreams}
              onLoadMore={() => {
                void loadFilterStreamPicker({
                  forClassId: classFilter,
                  cursor: filterStreamsCursor,
                  append: true,
                });
              }}
            />
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | EnrollmentStatus)}
          >
            <option value="">All statuses</option>
            {ENROLLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary" disabled={loading || loadingMore}>
          Apply filters
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
                yearIdQ: appliedYearId,
                studentIdQ: appliedStudentId,
                classFilter: appliedClassId,
                streamIdQ: appliedStreamId,
                statusFilter: appliedStatus,
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
