'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

import { EmptyState } from '@/components/admin-dashboard/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AssessmentImportRecord, JobOpening } from '@/types/admin-dashboard';
import { formatAdminDateTime } from '@/lib/utils';

export function ImportAssessmentsModal({
  open,
  onOpenChange,
  assessments,
  jobs,
  onImport,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  assessments: AssessmentImportRecord[];
  jobs: JobOpening[];
  onImport: (assessmentId: string, vacancyId: string) => void;
}) {
  const [vacancySelection, setVacancySelection] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="import-assessments-title">
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 id="import-assessments-title" className="text-xl font-semibold text-slate-950 dark:text-white">Vincular resultados no sincronizados</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Este paso es solo de respaldo manual para resultados que no pudieron vincularse automáticamente a una vacante.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar modal" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {assessments.length === 0 ? (
            <EmptyState
              title="No hay resultados pendientes de vinculación manual"
              description="Los resultados del assessment se están sincronizando automáticamente al pipeline. Este espacio solo se usa cuando una vinculación requiere revisión manual."
              icon={<Download className="h-6 w-6" />}
            />
          ) : (
            <div className="space-y-4">
              {assessments.map((assessment) => (
                <div key={assessment.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_140px] xl:items-end">
                    <div>
                      <p className="text-base font-semibold text-slate-950 dark:text-white">{assessment.candidateName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{assessment.candidateEmail} · {assessment.role || 'Rol no informado'}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        <span>Total {assessment.totalScore}</span>
                        <span>Técnico {assessment.technicalScore}</span>
                        <span>Cognitivo {assessment.cognitiveScore}</span>
                        <span>Soft {assessment.softSkillsScore}</span>
                        <span>{formatAdminDateTime(assessment.completedAt)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asignar a vacante</label>
                      <select
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                        value={vacancySelection[assessment.id] ?? ''}
                        onChange={(event) => setVacancySelection((current) => ({ ...current, [assessment.id]: event.target.value }))}
                      >
                        <option value="">Seleccionar vacante</option>
                        {jobs.map((job) => (
                          <option key={job.id} value={job.id}>{job.title}</option>
                        ))}
                      </select>
                    </div>
                    <Button disabled={!vacancySelection[assessment.id] || jobs.length === 0} onClick={() => onImport(assessment.id, vacancySelection[assessment.id])}>
                      Vincular
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
