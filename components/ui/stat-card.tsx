import type { ReactNode } from 'react';
import { Card } from './card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  accent?: boolean;
  children?: ReactNode;
}

export function StatCard({ label, value, sub, icon, accent, children }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight text-slate-900', accent && 'text-brand-700')}>
            {value}
          </p>
          {sub && <p className="mt-1 text-[12px] text-slate-500">{sub}</p>}
        </div>
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
            {icon}
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}
