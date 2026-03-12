import { BriefcaseBusiness } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { JobOpeningWithStats } from '@/types/admin-dashboard';
import { EmptyState } from '@/components/admin-dashboard/empty-state';
import { StatusBadge } from '@/components/admin-dashboard/status-badge';
import { getVacancyScoreProfileLabel } from '@/lib/admin-dashboard/vacancy-scoring';
import { formatAdminDate } from '@/lib/utils';

export function ActiveJobsTable({ jobs }: { jobs: JobOpeningWithStats[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Vacantes</CardTitle>
          <CardDescription>Datos calculados a partir de las vacantes y candidatos que el equipo cargó.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-4">
        {jobs.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState
              title="No hay vacantes todavía"
              description="Crea la primera vacante del workspace para empezar a capturar candidatos y resultados."
              icon={<BriefcaseBusiness className="h-6 w-6" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-y border-slate-200/80 bg-slate-50/90 text-xs uppercase tracking-[0.16em] text-slate-400 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Vacante</th>
                  <th className="px-6 py-4 font-medium">Departamento</th>
                  <th className="px-6 py-4 font-medium">Perfil score</th>
                  <th className="px-6 py-4 font-medium">Aplicados</th>
                  <th className="px-6 py-4 font-medium">Assessment</th>
                  <th className="px-6 py-4 font-medium">Entrevista</th>
                  <th className="px-6 py-4 font-medium">Shortlist</th>
                  <th className="px-6 py-4 font-medium">Recomendados</th>
                  <th className="px-6 py-4 font-medium">Reserva</th>
                  <th className="px-6 py-4 font-medium">No avanzar</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {jobs.map((job) => (
                  <tr key={job.id} className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-900/70">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-950 dark:text-white">{job.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{job.location} · {formatAdminDate(job.postedAt)}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{job.department}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{getVacancyScoreProfileLabel(job.scoreProfileId)}</td>
                    <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-slate-700 dark:text-slate-200">{job.appliedCount}</td>
                    <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-slate-700 dark:text-slate-200">{job.assessmentCount}</td>
                    <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-slate-700 dark:text-slate-200">{job.interviewCount}</td>
                    <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-cyan-700 dark:text-cyan-300">{job.shortlistedCount}</td>
                    <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-emerald-700 dark:text-emerald-300">{job.recommendedCount}</td>
                    <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-amber-700 dark:text-amber-300">{job.reserveCount}</td>
                    <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-rose-700 dark:text-rose-300">{job.noAdvanceCount}</td>
                    <td className="px-6 py-4"><StatusBadge status={job.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
