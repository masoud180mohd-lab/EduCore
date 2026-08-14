import type { ReactNode } from 'react';

import { AppProviders } from '@/components/AppProviders';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ThemeBootScript } from '@/components/ThemeBootScript';

import '@/styles/tokens.css';

export const metadata = {
  title: 'EduCore',
  description: 'School management — admin, teacher, and parent',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. Dark Reader) inject
    // attributes on <html>/<body> before React hydrates; that is not app state.
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeBootScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <AppProviders>
          <OfflineBanner />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
