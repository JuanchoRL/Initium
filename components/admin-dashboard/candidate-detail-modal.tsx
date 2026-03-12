'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles, TriangleAlert, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  buildCandidateDecision,
  getRecruiterDecisionMeta,
  getVacancyRecommendationMeta,
} from '@/lib/admin-dashboard/recruiter-decisioning';
import type {
  CandidatePipelineStage,
  CandidateResult,
  CandidateStatus,
  VacancyRecommendation,
} from '@/types/admin-dashboard';
import { getVacancyScoreProfileLabel } from '@/lib/admin-dashboard/vacancy-scoring';
import { formatAdminDate, formatAdminDateTime } from '@/lib/utils';

const scoreRows = [
  ['Ajuste técnico', 'technicalMatch'],
  ['Desempeño cognitivo', 'cognitivePerformance'],
  ['Ajuste conductual', 'behavioralFit'],
  ['Comunicación', 'communication'],
  ['Potencial de liderazgo', 'leadershipPotential'],
  ['Ajuste cultural', 'cultureFit'],
] as const;

const stageOptions: Array<{ value: CandidatePipelineStage; label: string }> = [
  { value: 'applied', label: 'Aplicado' },
  { value: 'screening', label: 'Filtro inicial' },
  { value: 'assessment', label: 'Evaluación' },
  { value: 'interview', label: 'Entrevista' },
  { value: 'final-review', label: 'Revisión final' },
  { value: 'hired', label: 'Contratado' },
];

const statusOptions: Array<{ value: CandidateStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'active', label: 'Activo' },
  { value: 'shortlisted', label: 'Preseleccionado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'hired', label: 'Contratado' },
];

export function CandidateDetailModal({
  candidate,
  onOpenChange,
  onUpdateCandidate,
  isUpdatingCandidate = false,
}: {
  candidate: CandidateResult | null;
  onOpenChange: (next: boolean) => void;
  onUpdateCandidate?: (payload: {
    id: string;
    status: CandidateStatus;
    pipelineStage: CandidatePipelineStage;
    shortlistManual?: boolean;
    vacancyRecommendation?: VacancyRecommendation;
  }) => void;
  isUpdatingCandidate?: boolean;
}) {
  const [statusDraft, setStatusDraft] = useState<CandidateStatus>('pending');
  const [stageDraft, setStageDraft] = useState<CandidatePipelineStage>('applied');
  const [shortlistDraft, setShortlistDraft] = useState(false);
  const [recommendationDraft, setRecommendationDraft] = useState<VacancyRecommendation>('reserve');

  useEffect(() => {
    if (!candidate) return;
    setStatusDraft(candidate.status);
    setStageDraft(candidate.pipelineStage);
    setShortlistDraft(Boolean(candidate.shortlistManual));
    setRecommendationDraft(candidate.vacancyRecommendation ?? buildCandidateDecision(candidate).recommendation);
  }, [candidate]);

  if (!candidate) return null;
  const fitScores = candidate.fitScores;
  const decision = buildCandidateDecision(candidate);
  const decisionMeta = getRecruiterDecisionMeta(decision.decision);
  const recommendationMeta = getVacancyRecommendationMeta(recommendationDraft);
  const hasProgressChanges =
    statusDraft !== candidate.status ||
    stageDraft !== candidate.pipelineStage ||
    shortlistDraft !== Boolean(candidate.shortlistManual) ||
    recommendationDraft !== (candidate.vacancyRecommendation ?? decision.recommendation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="candidate-detail-title">
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 id="candidate-detail-title" className="text-xl font-semibold text-slate-950 dark:text-white">{candidate.name}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{candidate.vacancy} · {candidate.department}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar modal" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Fuente</p>
                <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{candidate.source === 'assessment' ? 'Sincronizado desde assessment' : 'Carga manual'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Última actualización</p>
                <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{formatAdminDateTime(candidate.updatedAt)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{candidate.email}</Badge>
                <Badge variant="outline">{candidate.location || 'Sin ubicación'}</Badge>
                <Badge variant="outline">Aplicó el {formatAdminDate(candidate.appliedAt)}</Badge>
                {candidate.scoreProfileId ? <Badge variant="outline">Score {getVacancyScoreProfileLabel(candidate.scoreProfileId)}</Badge> : null}
              </div>
              {candidate.personalityProfile || candidate.strategyProfile ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Arquetipo</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{candidate.personalityProfile || 'Sin perfil disponible'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Perfil estratégico</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{candidate.strategyProfile || 'Sin perfil disponible'}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`rounded-3xl border p-5 ${decisionMeta.surfaceClass}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] opacity-70">Decisión sugerida</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={decisionMeta.badgeClass}>{decision.label}</Badge>
                    <Badge className={recommendationMeta.badgeClass}>{recommendationMeta.label}</Badge>
                    {candidate.vacancyRecommendationSource ? (
                      <Badge variant="outline">
                        {candidate.vacancyRecommendationSource === 'manual' ? 'Definida por recruiter' : 'Sugerida por sistema'}
                      </Badge>
                    ) : null}
                    <span className="text-sm opacity-80">Readiness {decision.readinessScore}/100</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-current/15 bg-white/60 px-4 py-3 text-right text-slate-900">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Siguiente paso</p>
                  <p className="mt-1 text-sm font-medium">{decision.nextStep}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-700">{decision.rationale}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-950">Señales para aprovechar</p>
                </div>
                <div className="space-y-3">
                  {decision.strengths.length ? (
                    decision.strengths.map((item) => (
                      <div key={item} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm leading-relaxed text-emerald-900">
                        {item}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Todavía no hay una fortaleza dominante lo bastante nítida para acelerar sin contraste adicional.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-semibold text-slate-950">Riesgos a validar</p>
                </div>
                <div className="space-y-3">
                  {decision.risks.length ? (
                    decision.risks.map((item) => (
                      <div key={item} className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-sm leading-relaxed text-amber-900">
                        {item}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No aparece una alerta crítica. Aun así, conviene validar consistencia en entrevista.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-600" />
                <p className="text-sm font-semibold text-slate-950">Foco táctico para entrevista</p>
              </div>
              <div className="grid gap-3">
                {decision.prompts.map((prompt) => (
                  <div key={prompt.title} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ArrowRight className="h-4 w-4 text-cyan-600" />
                      {prompt.title}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{prompt.question}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">Señal esperada: {prompt.signal}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

            <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-950/80">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Pipeline</p>
              <div className="mt-3 grid gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Etapa</label>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                    value={stageDraft}
                    onChange={(event) => setStageDraft(event.target.value as CandidatePipelineStage)}
                  >
                    {stageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Estado</label>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value as CandidateStatus)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Recomendación vacante</label>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                    value={recommendationDraft}
                    onChange={(event) => setRecommendationDraft(event.target.value as VacancyRecommendation)}
                  >
                    <option value="recommended">Recomendado</option>
                    <option value="reserve">Reserva</option>
                    <option value="no-advance">No avanzar</option>
                  </select>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Shortlist manual</p>
                      <p className="mt-1 text-sm text-slate-700">Marca si el recruiter quiere sostener este perfil entre los prioritarios.</p>
                    </div>
                    <Button
                      type="button"
                      variant={shortlistDraft ? 'default' : 'outline'}
                      className={shortlistDraft ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'border-cyan-200 text-cyan-700'}
                      onClick={() => setShortlistDraft((current) => !current)}
                    >
                      {shortlistDraft ? 'En shortlist' : 'Guardar shortlist'}
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    onUpdateCandidate?.({
                      id: candidate.id,
                      status: statusDraft,
                      pipelineStage: stageDraft,
                      shortlistManual: shortlistDraft,
                      vacancyRecommendation: recommendationDraft,
                    })
                  }
                  disabled={!hasProgressChanges || isUpdatingCandidate}
                >
                  {isUpdatingCandidate ? 'Guardando...' : 'Guardar progreso'}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Score total</p>
              <div className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">{candidate.totalScore ?? '--'}</div>
            </div>
            {fitScores ? (
              <div className="space-y-3">
                {scoreRows.map(([label, key]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                      <span className="font-[family:var(--font-admin-mono)] text-slate-500 dark:text-slate-400">{fitScores[key]}/100</span>
                    </div>
                    <Progress value={fitScores[key]} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Este candidato todavía no tiene breakdown de fit cargado.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
