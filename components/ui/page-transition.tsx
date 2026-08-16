'use client';

import { ReactNode } from 'react';

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="page-animate">
      {children}
    </div>
  );
}
