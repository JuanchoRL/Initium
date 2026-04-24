'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { CandidatePipelineStage, CandidateStatus, JobOpening } from '@/types/admin-dashboard';

export type AddCandidatePayload = {
  name: string;
  email: string;
  phone: string;
  vacancyId: string;
  location: string;
  status: CandidateStatus;
  pipelineStage: CandidatePipelineStage;
  technicalScore: number | null;
  cognitiveScore: number | null;
  softSkillsScore: number | null;
};

const stages: Array<{ value: CandidatePipelineStage; label: string }> = [
  { value: 'applied', label: 'Aplicado' },
  { value: 'screening', label: 'Filtro inicial' },
  { value: 'assessment', label: 'Evaluación' },
  { value: 'final-review', label: 'Revisión final' },
  { value: 'hired', label: 'Contratado' },
];

const statuses: Array<{ value: CandidateStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'active', label: 'Activo' },
  { value: 'shortlisted', label: 'Shortlist' },
  { value: 'hired', label: 'Contratado' },
  { value: 'rejected', label: 'No avanzar' },
];

const toNullableNumber = (value: FormDataEntryValue | null) => {
  const raw = Number(value);
  return Number.isFinite(raw) && String(value).trim() !== '' ? raw : null;
};

export function AddCandidateModal({
  open,
  onOpenChange,
  onCreate,
  jobs,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreate: (payload: AddCandidatePayload) => void;
  jobs: JobOpening[];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-candidate-title">
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 id="add-candidate-title" className="text-xl font-semibold text-slate-950 dark:text-white">Nuevo candidato</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Carga un perfil manualmente y, si ya tienes scores, guárdalos desde el mismo formulario.</p>
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
              name: String(formData.get('name') ?? ''),
              email: String(formData.get('email') ?? ''),
              phone: String(formData.get('phone') ?? ''),
              vacancyId: String(formData.get('vacancyId') ?? ''),
              location: String(formData.get('location') ?? ''),
              status: String(formData.get('status') ?? 'pending') as CandidateStatus,
              pipelineStage: String(formData.get('pipelineStage') ?? 'applied') as CandidatePipelineStage,
              technicalScore: toNullableNumber(formData.get('technicalScore')),
              cognitiveScore: toNullableNumber(formData.get('cognitiveScore')),
              softSkillsScore: toNullableNumber(formData.get('softSkillsScore')),
            });
            onOpenChange(false);
            event.currentTarget.reset();
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="candidate-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
              <Input id="candidate-name" name="name" required placeholder="Nombre del candidato" />
            </div>
            <div className="space-y-2">
              <label htmlFor="candidate-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
              <Input id="candidate-email" name="email" type="email" required placeholder="correo@empresa.com" />
            </div>
            <div className="space-y-2">
              <label htmlFor="candidate-phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
              <Input id="candidate-phone" name="phone" placeholder="+598 99 000 000" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="candidate-vacancy" className="text-sm font-medium text-slate-700 dark:text-slate-300">Vacante</label>
              <select id="candidate-vacancy" name="vacancyId" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <option value="">Seleccionar vacante</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="candidate-location" className="text-sm font-medium text-slate-700 dark:text-slate-300">Ubicación</label>
              <Input id="candidate-location" name="location" placeholder="Remote / ciudad" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="candidate-stage" className="text-sm font-medium text-slate-700 dark:text-slate-300">Etapa</label>
              <select id="candidate-stage" name="pipelineStage" defaultValue="applied" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {stages.map((stage) => (
                  <option key={stage.value} value={stage.value}>{stage.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="candidate-status" className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <select id="candidate-status" name="status" defaultValue="pending" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="candidate-technical" className="text-sm font-medium text-slate-700 dark:text-slate-300">Score técnico</label>
              <Input id="candidate-technical" name="technicalScore" type="number" min="0" max="100" placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <label htmlFor="candidate-cognitive" className="text-sm font-medium text-slate-700 dark:text-slate-300">Score cognitivo</label>
              <Input id="candidate-cognitive" name="cognitiveScore" type="number" min="0" max="100" placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <label htmlFor="candidate-soft" className="text-sm font-medium text-slate-700 dark:text-slate-300">Soft skills</label>
              <Input id="candidate-soft" name="softSkillsScore" type="number" min="0" max="100" placeholder="Opcional" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={jobs.length === 0}>Guardar candidato</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
