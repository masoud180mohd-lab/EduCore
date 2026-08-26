'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentProps<'div'> {
  value?: number;
}

export function Progress({ className, value = 0, ...props }: ProgressProps): React.ReactElement {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-[var(--secondary)]',
        className,
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-[var(--primary)] transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
