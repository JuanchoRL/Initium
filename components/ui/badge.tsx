import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type BadgeVariant = 'neutral' | 'active' | 'pending' | 'rejected' | 'shortlisted' | 'hired' | 'outline' | 'critical';

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  shortlisted: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  hired: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  outline: 'border border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300',
  critical: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
