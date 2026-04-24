'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { VACANCY_SCORE_PROFILE_OPTIONS } from '@/lib/admin-dashboard/vacancy-scoring';
import type { JobOpeningWithStats, JobStatus, VacancyScoreProfileId } from '@/types/admin-dashboard';

type UpdateVacancyPayload = {
  id: string;
  title: string;
  department: string;
  location: string;
  scoreProfileId: VacancyScoreProfileId;
  jobDescription: string;
  status: JobStatus;
};

export function EditVacancyModal({
  job,
  open,
  onOpenChange,
  onUpdate,
}: {
  job: JobOpeningWithStats | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onUpdate: (payload: UpdateVacancyPayload) => void;
}) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [scoreProfileId, setScoreProfileId] = useState<VacancyScoreProfileId>('generalist');
  const [jobDescription, setJobDescription] = useState('');
  const [status, setStatus] = useState<JobStatus>('active');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !job) return;
    setTitle(job.title || '');
    setDepartment(job.department || '');
    setLocation(job.location || '');
    setScoreProfileId(job.scoreProfileId || 'generalist');
    setJobDescription(job.jobDescription || '');
    setStatus(job.status || 'active');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open, job]);

  if (!open || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-vacancy-title">
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 id="edit-vacancy-title" className="text-xl font-semibold text-slate-950 dark:text-white">Editar vacante</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Modifica los datos del rol cargado.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar modal" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <form
          className="space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate({
              id: job.id,
              title,
              department,
              location,
              scoreProfileId,
              jobDescription,
              status,
            });
            onOpenChange(false);
          }}
        >
          <div className="space-y-2">
            <label htmlFor="edit-vacancy-title" className="text-sm font-medium text-slate-700 dark:text-slate-300">Título de la vacante</label>
            <Input id="edit-vacancy-title" name="title" required placeholder="Ej. Senior Backend Engineer" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="edit-vacancy-department" className="text-sm font-medium text-slate-700 dark:text-slate-300">Departamento</label>
              <Input id="edit-vacancy-department" name="department" required placeholder="Engineering" value={department} onChange={(event) => setDepartment(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-vacancy-location" className="text-sm font-medium text-slate-700 dark:text-slate-300">Ubicación</label>
              <Input id="edit-vacancy-location" name="location" required placeholder="Remote LATAM" value={location} onChange={(event) => setLocation(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-vacancy-score-profile" className="text-sm font-medium text-slate-700 dark:text-slate-300">Perfil de score de la vacante</label>
            <select
              id="edit-vacancy-score-profile"
              name="scoreProfileId"
              value={scoreProfileId}
              onChange={(event) => setScoreProfileId(event.target.value as VacancyScoreProfileId)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              {VACANCY_SCORE_PROFILE_OPTIONS.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cambiar este perfil modificará cómo se interpretan los resultados de los candidatos.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-vacancy-job-description" className="text-sm font-medium text-slate-700 dark:text-slate-300">Job description</label>
            <textarea
              id="edit-vacancy-job-description"
              name="jobDescription"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              rows={6}
              placeholder="Pega aquí la job description o sube un archivo .txt / .md para completar el rol."
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="block text-xs text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-cyan-50 hover:file:text-cyan-700"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    setJobDescription(text);
                  } catch {
                    setJobDescription((current) => current);
                  }
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Actualizar vacante</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
