'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CandidateResult, InterviewStatus } from '@/types/admin-dashboard';

export type ScheduleInterviewPayload = {
  candidateId: string;
  interviewer: string;
  date: string;
  time: string;
  status: InterviewStatus;
  format: 'Video' | 'On-site';
};

export function ScheduleInterviewModal({
  open,
  onOpenChange,
  onCreate,
  candidates,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreate: (payload: ScheduleInterviewPayload) => void;
  candidates: CandidateResult[];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="schedule-interview-title">
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 id="schedule-interview-title" className="text-xl font-semibold text-slate-950 dark:text-white">Agendar entrevista</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Programa una entrevista para un candidato ya cargado en el workspace.</p>
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
              candidateId: String(formData.get('candidateId') ?? ''),
              interviewer: String(formData.get('interviewer') ?? ''),
              date: String(formData.get('date') ?? ''),
              time: String(formData.get('time') ?? ''),
              status: String(formData.get('status') ?? 'pending') as InterviewStatus,
              format: String(formData.get('format') ?? 'Video') as 'Video' | 'On-site',
            });
            onOpenChange(false);
            event.currentTarget.reset();
          }}
        >
          <div className="space-y-2">
            <label htmlFor="interview-candidate" className="text-sm font-medium text-slate-700 dark:text-slate-300">Candidato</label>
            <select id="interview-candidate" name="candidateId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              <option value="">Seleccionar candidato</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.vacancy}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="interview-date" className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha</label>
              <Input id="interview-date" name="date" type="date" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="interview-time" className="text-sm font-medium text-slate-700 dark:text-slate-300">Hora</label>
              <Input id="interview-time" name="time" type="time" required />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="interview-interviewer" className="text-sm font-medium text-slate-700 dark:text-slate-300">Entrevistador</label>
              <Input id="interview-interviewer" name="interviewer" required placeholder="Nombre del entrevistador" />
            </div>
            <div className="space-y-2">
              <label htmlFor="interview-format" className="text-sm font-medium text-slate-700 dark:text-slate-300">Formato</label>
              <select id="interview-format" name="format" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <option value="Video">Video</option>
                <option value="On-site">On-site</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="interview-status" className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
            <select id="interview-status" name="status" defaultValue="pending" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={candidates.length === 0}>Guardar entrevista</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
