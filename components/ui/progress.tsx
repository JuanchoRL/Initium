import { cn } from '@/lib/utils';

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900', className)}>
      <div
        className={cn('h-full rounded-full bg-cyan-500 transition-all duration-500', indicatorClassName)}
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
