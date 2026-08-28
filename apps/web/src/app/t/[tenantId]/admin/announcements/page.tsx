'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  Mail,
  MessageSquare,
  Megaphone,
  Radio,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';

import { AdminPageHeader, Banner } from '@/components/admin';
import { AdminShell } from '@/components/AdminShell';
import { useAppPreferences } from '@/components/AppProviders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminAnnouncementsPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const { t } = useAppPreferences();
  const base = `/t/${tenantId}/admin`;

  const channels = [
    {
      title: 'Arifa na Ujumbe wa SMS (SMS Alerts)',
      description: 'Tuma jumbe za SMS kwa wazazi na walezi kwa kutumia violezo rasmi vya shule (Templates & Locales).',
      href: `${base}/notifications`,
      icon: MessageSquare,
      accent: 'from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20',
      badge: 'Inayotumika Sasa (Active)',
      actionText: 'Fungua SMS Hub',
    },
    {
      title: 'Ubao wa Matangazo ya Shule (School Noticeboard)',
      description: 'Chapisha matangazo kwa walimu, wanafunzi, na wazazi ndani ya milango yao (Portals).',
      href: `${base}/announcements`,
      icon: Megaphone,
      accent: 'from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badge: 'Portal Broadcasts',
      actionText: 'Tazama Matangazo',
    },
    {
      title: 'Arifa za Mfumo (In-App Push Alerts)',
      description: 'Taarifa za kiotomatiki za mfumo kama vile mahudhurio, matokeo mapya ya mitihani, na ankara za ada.',
      href: `${base}/notifications`,
      icon: Bell,
      accent: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      badge: 'Automated Alerts',
      actionText: 'Sanidi Arifa',
    },
  ];

  return (
    <AdminShell tenantId={tenantId}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Link href={`/t/${tenantId}/admin`} className="hover:underline text-primary">
                ← {t('common.admin')}
              </Link>
            </p>
            <AdminPageHeader
              title="Kituo cha Mawasiliano na Matangazo (Communications Hub)"
              description="Simamia usambazaji wa matangazo ya shule, jumbe za SMS kwa wazazi, na arifa za mfumo."
            />
          </div>

          <Button asChild size="sm">
            <Link href={`${base}/notifications`}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Tuma SMS Mpya
            </Link>
          </Button>
        </div>

        {/* Channels Bento Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <Link key={channel.title} href={channel.href} className="group block focus:outline-none">
                <Card className="h-full border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="space-y-1">
                      <span className="rounded-md border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {channel.badge}
                      </span>
                      <CardTitle className="text-base font-bold group-hover:text-primary transition-colors mt-2">
                        {channel.title}
                      </CardTitle>
                    </div>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-gradient-to-br ${channel.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-xs line-clamp-3 leading-relaxed">
                      {channel.description}
                    </CardDescription>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs font-medium text-muted-foreground">
                      <span className="font-semibold text-primary group-hover:underline">
                        {channel.actionText}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
