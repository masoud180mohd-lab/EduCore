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
    blurb: 'Create and close school years',
  },
  {
    hrefSuffix: '/terms',
    title: 'Terms',
    blurb: 'Terms within a year',
  },
  {
    hrefSuffix: '/classes',
    title: 'Classes',
    blurb: 'Classes by year',
  },
  {
    hrefSuffix: '/streams',
    title: 'Streams',
    blurb: 'Streams within a class',
  },
  {
    hrefSuffix: '/subjects',
    title: 'Subjects',
    blurb: 'Subject catalog',
  },
  {
    hrefSuffix: '/enrollments',
    title: 'Enrollments',
    blurb: 'Place students in classes or streams',
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
