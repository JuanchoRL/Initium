'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { VACANCY_SCORE_PROFILE_OPTIONS } from '@/lib/admin-dashboard/vacancy-scoring';
import type { VacancyScoreProfileId } from '@/types/admin-dashboard';

type CreateVacancyPayload = {
  title: string;
  department: string;
  location: string;
  scoreProfileId: VacancyScoreProfileId;
};

export function CreateVacancyModal({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreate: (payload: CreateVacancyPayload) => void;
}) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="create-vacancy-title">
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 id="create-vacancy-title" className="text-xl font-semibold text-slate-950 dark:text-white">Nueva vacante</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Crea un rol y añádelo al tablero sin salir del dashboard.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar modal" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <form
          className="space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            onCreate({
              title: String(formData.get('title') ?? ''),
              department: String(formData.get('department') ?? ''),
              location: String(formData.get('location') ?? ''),
              scoreProfileId: String(formData.get('scoreProfileId') ?? 'generalist') as VacancyScoreProfileId,
            });
            onOpenChange(false);
            event.currentTarget.reset();
          }}
        >
          <div className="space-y-2">
            <label htmlFor="vacancy-title" className="text-sm font-medium text-slate-700 dark:text-slate-300">Título de la vacante</label>
            <Input id="vacancy-title" name="title" required placeholder="Ej. Senior Backend Engineer" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="vacancy-department" className="text-sm font-medium text-slate-700 dark:text-slate-300">Departamento</label>
              <Input id="vacancy-department" name="department" required placeholder="Engineering" />
            </div>
            <div className="space-y-2">
              <label htmlFor="vacancy-location" className="text-sm font-medium text-slate-700 dark:text-slate-300">Ubicación</label>
              <Input id="vacancy-location" name="location" required placeholder="Remote LATAM" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="vacancy-score-profile" className="text-sm font-medium text-slate-700 dark:text-slate-300">Perfil de score de la vacante</label>
            <select
              id="vacancy-score-profile"
              name="scoreProfileId"
              defaultValue="generalist"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              {VACANCY_SCORE_PROFILE_OPTIONS.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Define qué competencias pesarán más al interpretar los resultados del assessment para esta vacante.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Guardar vacante</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
