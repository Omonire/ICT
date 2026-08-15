import type { ReactNode } from 'react';

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-reveal style={{ opacity: 0, transform: 'translateY(24px)' }} className={className}>
      {children}
    </div>
  );
}
