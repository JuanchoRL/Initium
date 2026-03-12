import { AlertTriangle, CheckCircle2, Sparkles, TimerReset } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AlertItem } from '@/types/admin-dashboard';
import { EmptyState } from '@/components/admin-dashboard/empty-state';

const severityMap = {
  critical: { icon: AlertTriangle, color: 'text-rose-500', surface: 'bg-rose-500/10' },
  warning: { icon: TimerReset, color: 'text-amber-500', surface: 'bg-amber-500/10' },
  info: { icon: AlertTriangle, color: 'text-sky-500', surface: 'bg-sky-500/10' },
  success: { icon: Sparkles, color: 'text-emerald-500', surface: 'bg-emerald-500/10' },
} as const;

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Alertas y to-do</CardTitle>
          <CardDescription>Bloqueadores, revisiones y acciones pendientes del equipo.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {alerts.length === 0 ? (
          <EmptyState
            title="Todo bajo control"
            description="No hay alertas nuevas ni tareas operativas pendientes en este momento."
            icon={<CheckCircle2 className="h-6 w-6" />}
          />
        ) : (
          alerts.map((alert) => {
            const Icon = severityMap[alert.severity].icon;
            return (
              <div key={alert.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-2xl p-2 ${severityMap[alert.severity].surface}`}>
                    <Icon className={`h-4 w-4 ${severityMap[alert.severity].color}`} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="font-medium text-slate-950 dark:text-white">{alert.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{alert.description}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{alert.meta}</span>
                      <Button variant="ghost" size="sm" className="h-8 px-0 text-cyan-600 dark:text-cyan-300">
                        {alert.actionLabel}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
