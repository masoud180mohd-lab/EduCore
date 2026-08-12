'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';

type AcademicHubLink = {
  readonly hrefSuffix: string;
  readonly title: string;
  readonly blurb: string;
};

const ACADEMIC_LINKS: ReadonlyArray<AcademicHubLink> = [
  {
    hrefSuffix: '/years',
    title: 'Academic years',
    blurb: 'Create years — search and filter by status',
  },
  {
    hrefSuffix: '/terms',
    title: 'Terms',
    blurb: 'Terms by year — search and status filters',
  },
  {
    hrefSuffix: '/classes',
    title: 'Classes',
    blurb: 'Classes by year — search and status filters',
  },
  {
    hrefSuffix: '/streams',
    title: 'Streams',
    blurb: 'Streams by class — search and status filters',
  },
  {
    hrefSuffix: '/subjects',
    title: 'Subjects',
    blurb: 'Subject catalog — search and status filters',
  },
  {
    hrefSuffix: '/enrollments',
    title: 'Enrollments',
    blurb: 'Filter by year, student, class, stream, status',
  },
];

export default function AdminAcademicHubPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const base = `/t/${tenantId}/admin/academic`;

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin`}>← Admin</Link>
      </p>
      <AdminPageHeader
        title="Academic"
        description="School year tree and enrollments. Edit structure on detail pages; delete only when nothing depends on the record."
      />
      <ul className="list">
        {ACADEMIC_LINKS.map((link) => (
          <li key={link.hrefSuffix}>
            <Link className="card" href={`${base}${link.hrefSuffix}`}>
              <strong>{link.title}</strong>
              <div className="muted">{link.blurb}</div>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
