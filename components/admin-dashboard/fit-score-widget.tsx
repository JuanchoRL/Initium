import { ArrowUpRight, GaugeCircle } from 'lucide-react';

import { EmptyState } from '@/components/admin-dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { FitScoreCategory } from '@/types/admin-dashboard';

export function FitScoreWidget({ categories }: { categories: FitScoreCategory[] }) {
  if (categories.length === 0) {
    return (
      <Card className="h-full overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Hiring Health Score</CardTitle>
            <CardDescription>Este widget se activa cuando existen resultados reales para agregar.</CardDescription>
          </div>
          <Badge variant="outline">Candidate Fit Overview</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <EmptyState
            title="Sin datos de evaluación todavía"
            description="Espera la sincronización automática del assessment o carga scores manuales para ver tendencias agregadas."
          />
        </CardContent>
      </Card>
    );
  }

  const overall = Math.round(categories.reduce((sum, item) => sum + item.value, 0) / categories.length);
  const topCategory = [...categories].sort((a, b) => b.value - a.value)[0];

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Hiring Health Score</CardTitle>
          <CardDescription>Lectura agregada a partir de los resultados reales cargados en el workspace.</CardDescription>
        </div>
        <Badge variant="outline">Candidate Fit Overview</Badge>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
          <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-full" style={{ background: `conic-gradient(#06b6d4 ${overall * 3.6}deg, rgba(148,163,184,0.16) 0deg)` }}>
            <div className="flex h-[calc(100%-18px)] w-[calc(100%-18px)] flex-col items-center justify-center rounded-full bg-white text-center shadow-inner dark:bg-slate-950">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-300">
                <GaugeCircle className="h-3.5 w-3.5" />
                Health score
              </div>
              <div className="mt-3 text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">{overall}</div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Promedio agregado</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-300">Top signal</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{topCategory.label}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{topCategory.note}</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3 text-cyan-600 shadow-sm dark:bg-slate-950/70 dark:text-cyan-300">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{category.label}</span>
                    <span className="font-[family:var(--font-admin-mono)] text-slate-500 dark:text-slate-400">{category.value}/100</span>
                  </div>
                  <Progress value={category.value} indicatorClassName={category.value >= 85 ? 'bg-emerald-500' : category.value >= 75 ? 'bg-cyan-500' : 'bg-amber-500'} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
