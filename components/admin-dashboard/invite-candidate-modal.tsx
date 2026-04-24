'use client';

import { useEffect } from 'react';
import { CalendarClock, Mail, Phone, Send, UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { JobOpening } from '@/types/admin-dashboard';

export type InviteCandidatePayload = {
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  vacancyId: string;
  expiresAt: string;
};

function buildDefaultDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 4);
  date.setHours(18, 0, 0, 0);
  return {
    date: date.toISOString().slice(0, 10),
    time: '18:00',
  };
}

export function InviteCandidateModal({
  open,
  onOpenChange,
  onCreate,
  jobs,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreate: (payload: InviteCandidatePayload) => void;
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
  const defaults = buildDefaultDeadline();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-candidate-title"
    >
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 w-full max-w-2xl overflow-hidden border-slate-200 shadow-[0_28px_80px_-40px_rgba(14,165,233,0.45)]">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5">
          <div>
            <h2 id="invite-candidate-title" className="text-2xl font-semibold tracking-tight text-slate-950">
              Invita a candidatos
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Envía una evaluación con fecha límite y deja el acceso vinculado a la vacante correspondiente.
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar modal" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <form
          className="space-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const date = String(formData.get('expiresDate') ?? '');
            const time = String(formData.get('expiresTime') ?? '18:00');
            onCreate({
              candidateName: String(formData.get('candidateName') ?? ''),
              candidateEmail: String(formData.get('candidateEmail') ?? ''),
              candidatePhone: String(formData.get('candidatePhone') ?? ''),
              vacancyId: String(formData.get('vacancyId') ?? ''),
              expiresAt: new Date(`${date}T${time}:00`).toISOString(),
            });
            onOpenChange(false);
            event.currentTarget.reset();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="invite-candidate-name" className="text-sm font-medium text-slate-700">
                Nombre del candidato
              </label>
              <div className="relative">
                <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="invite-candidate-name" name="candidateName" required className="pl-10" placeholder="Ej. Camila López" />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="invite-candidate-email" className="text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="invite-candidate-email" name="candidateEmail" type="email" required className="pl-10" placeholder="camila@email.com" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <label htmlFor="invite-vacancy" className="text-sm font-medium text-slate-700">
                Vacante asignada
              </label>
              <select
                id="invite-vacancy"
                name="vacancyId"
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <option value="">Seleccionar vacante</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} · {job.department}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="invite-candidate-phone" className="text-sm font-medium text-slate-700">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="invite-candidate-phone" name="candidatePhone" className="pl-10" placeholder="+598 99 000 000" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-cyan-800">
              <CalendarClock className="h-4 w-4" />
              <p className="text-sm font-semibold">Vigencia de la evaluación</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="invite-expire-date" className="text-sm font-medium text-slate-700">
                  Fecha límite
                </label>
                <Input id="invite-expire-date" name="expiresDate" type="date" required defaultValue={defaults.date} />
              </div>
              <div className="space-y-2">
                <label htmlFor="invite-expire-time" className="text-sm font-medium text-slate-700">
                  Hora límite
                </label>
                <Input id="invite-expire-time" name="expiresTime" type="time" required defaultValue={defaults.time} />
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              El enlace caducará automáticamente en la fecha y hora configuradas para este candidato.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={jobs.length === 0}>
              <Send className="mr-2 h-4 w-4" />
              Enviar evaluación
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
