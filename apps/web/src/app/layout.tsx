import type { ReactNode } from 'react';

import { OfflineBanner } from '@/components/OfflineBanner';

import '@/styles/tokens.css';

export const metadata = {
  title: 'EduCore Teacher',
  description: 'Teacher attendance capture',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=swap"
        />
      </head>
      <body>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
