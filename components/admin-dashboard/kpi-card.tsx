import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { KpiMetric } from '@/types/admin-dashboard';
import { cn, formatDelta } from '@/lib/utils';

export function KpiCard({ metric }: { metric: KpiMetric }) {
  const isPositive =
    metric.delta == null
      ? null
      : metric.delta === 0 || (metric.delta > 0 ? metric.improvesWhen === 'higher' : metric.improvesWhen === 'lower');
  const TrendIcon = metric.delta == null ? Minus : metric.delta >= 0 ? ArrowUpRight : ArrowDownRight;
  const toneClass =
    isPositive == null
      ? 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400'
      : isPositive
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-300';

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-600 dark:text-cyan-300">
            <metric.icon className="h-5 w-5" />
          </div>
          <div className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em]', toneClass)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {formatDelta(metric.delta)}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm text-slate-500 dark:text-slate-400">{metric.title}</p>
          <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{metric.value}</div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{metric.caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}
