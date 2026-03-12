import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@/components/admin-dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PipelineStage } from '@/types/admin-dashboard';
import { formatCompactNumber } from '@/lib/utils';

export function PipelineChart({ stages }: { stages: PipelineStage[] }) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <Card className="h-full">
      <CardHeader className="items-center">
        <div>
          <CardTitle>Pipeline overview</CardTitle>
          <CardDescription>Distribución por etapa y ratio de conversión entre tramos.</CardDescription>
        </div>
        <Badge variant="outline">{formatCompactNumber(total)} registros</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {total === 0 ? (
          <EmptyState
            title="Aún no hay pipeline"
            description="Crea una vacante y carga candidatos para empezar a ver la distribución del funnel."
          />
        ) : (
          <>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stages} barGap={12}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as PipelineStage;
                      return (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                          <p className="text-sm font-semibold text-slate-950 dark:text-white">{item.label}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{item.count.toLocaleString('es-ES')} candidatos</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-300">{item.conversion}% conversion</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[12, 12, 4, 4]}>
                    {stages.map((stage) => (
                      <Cell key={stage.id} fill={stage.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {stages.map((stage) => (
                <div key={stage.id} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-950 dark:text-white">{stage.label}</span>
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{stage.count}</span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{stage.conversion}% step conversion</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
