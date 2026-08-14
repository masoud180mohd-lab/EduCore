'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import type { MessageKey } from '@/lib/i18n/messages';

type AcademicHubLink = {
  readonly hrefSuffix: string;
  readonly titleKey: MessageKey;
  readonly blurbKey: MessageKey;
};

const ACADEMIC_LINKS: ReadonlyArray<AcademicHubLink> = [
  { hrefSuffix: '/years', titleKey: 'academic.years', blurbKey: 'academic.yearsBlurb' },
  { hrefSuffix: '/terms', titleKey: 'academic.terms', blurbKey: 'academic.termsBlurb' },
  { hrefSuffix: '/classes', titleKey: 'academic.classes', blurbKey: 'academic.classesBlurb' },
  { hrefSuffix: '/streams', titleKey: 'academic.streams', blurbKey: 'academic.streamsBlurb' },
  { hrefSuffix: '/subjects', titleKey: 'academic.subjects', blurbKey: 'academic.subjectsBlurb' },
  {
    hrefSuffix: '/enrollments',
    titleKey: 'academic.enrollments',
    blurbKey: 'academic.enrollmentsBlurb',
  },
];

export default function AdminAcademicHubPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin/academic`;

  return (
    <AdminShell tenantId={tenantId}>
      <p className="muted">
        <Link href={`/t/${tenantId}/admin`}>← {t('common.admin')}</Link>
      </p>
      <AdminPageHeader title={t('academic.title')} description={t('academic.description')} />
      <ul className="list">
        {ACADEMIC_LINKS.map((link) => (
          <li key={link.hrefSuffix}>
            <Link className="card" href={`${base}${link.hrefSuffix}`}>
              <strong>{t(link.titleKey)}</strong>
              <div className="muted">{t(link.blurbKey)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
