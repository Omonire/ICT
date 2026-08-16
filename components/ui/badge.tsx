import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700',
        brand: 'bg-purple-50 text-purple-700',
        green: 'bg-gold-50 text-gold-700',
        amber: 'bg-amber-50 text-amber-700',
        red: 'bg-red-50 text-red-700',
        slate: 'bg-slate-100 text-slate-600',
        outline: 'border-[0.5px] border-slate-300 bg-white text-slate-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'brand' | 'green' | 'amber' | 'red' | 'slate' | 'outline'> = {
    scheduled: 'brand',
    completed: 'green',
    unscheduled: 'slate',
    confirmed: 'green',
    draft: 'amber',
    none: 'slate',
    active: 'green',
    disabled: 'red',
    occupied: 'brand',
    available: 'slate',
    imported: 'brand',
    seeded: 'slate',
  };
  return (
    <Badge variant={map[status] ?? 'slate'}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          map[status] === 'green' && 'bg-gold-500',
          map[status] === 'brand' && 'bg-purple-600',
          map[status] === 'amber' && 'bg-amber-500',
          map[status] === 'red' && 'bg-red-500',
          map[status] === 'slate' && 'bg-slate-400',
          map[status] === 'outline' && 'bg-slate-300'
        )}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export { Badge, badgeVariants };
