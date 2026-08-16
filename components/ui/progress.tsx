import { cn } from '@/lib/utils';

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full bg-purple-600 transition-all duration-300 ease-out', indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function ProgressLabeled({
  value,
  label,
  hint,
  indicatorClassName,
}: {
  value: number;
  label?: string;
  hint?: string;
  indicatorClassName?: string;
}) {
  return (
    <div>
      {(label || hint) && (
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="font-medium text-slate-600">{label}</span>
          <span className="font-mono text-slate-400">{hint ?? `${value}%`}</span>
        </div>
      )}
      <Progress value={value} indicatorClassName={indicatorClassName} />
    </div>
  );
}
