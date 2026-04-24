import {
  AlertTriangle,
  ArrowUpRight,
  Gauge,
  Sparkles,
  Target,
  UserRoundSearch,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CandidateResult } from '@/types/admin-dashboard';
import { EmptyState } from '@/components/admin-dashboard/empty-state';
import {
  buildCandidateDecision,
  getRecruiterDecisionMeta,
  getVacancyRecommendationMeta,
} from '@/lib/admin-dashboard/recruiter-decisioning';
import { getVacancyScoreProfileLabel } from '@/lib/admin-dashboard/vacancy-scoring';
import { formatAdminDate } from '@/lib/utils';

const scoreCell = (value: number | null) => (value == null ? '--' : String(value));

function ExecutiveMetric({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'cyan' | 'emerald' | 'amber';
}) {
  const toneClass =
    tone === 'cyan'
      ? 'border-cyan-100 bg-cyan-50/80 text-cyan-800'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50/80 text-emerald-800'
        : tone === 'amber'
          ? 'border-amber-100 bg-amber-50/80 text-amber-800'
          : 'border-slate-200 bg-slate-50/90 text-slate-800';

  return (
    <div className={`rounded-2xl border px-3 py-3 shadow-sm ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function CandidateResultsTable({
  candidates,
  title = 'Resultados de evaluación',
  description = 'Lectura ejecutiva de candidatos evaluados y cargados en el workspace.',
  showExecutiveHeader = false,
  onViewCandidate,
  onShortlistCandidate,
  onToggleShortlistCandidate,
}: {
  candidates: CandidateResult[];
  title?: string;
  description?: string;
  showExecutiveHeader?: boolean;
  onViewCandidate?: (candidate: CandidateResult) => void;
  onShortlistCandidate?: (candidate: CandidateResult) => void;
  onToggleShortlistCandidate?: (candidate: CandidateResult) => void;
}) {
  const candidatesWithDecision = candidates.map((candidate) => ({
    candidate,
    decision: buildCandidateDecision(candidate),
  }));

  const shortlistedCount = candidatesWithDecision.filter(({ candidate }) => Boolean(candidate.shortlistManual)).length;
  const advanceCount = candidatesWithDecision.filter(({ decision }) => decision.decision === 'advance').length;
  const reviewCount = candidatesWithDecision.filter(({ decision }) => decision.decision === 'review').length;
  const averageTotalScore = candidatesWithDecision.length
    ? Math.round(
        candidatesWithDecision.reduce((sum, item) => sum + (item.candidate.totalScore ?? 0), 0) / candidatesWithDecision.length,
      )
    : 0;

  return (
    <Card className="overflow-hidden border-slate-200/90 bg-white shadow-[0_18px_40px_-28px_rgba(14,165,233,0.2)]">
      {showExecutiveHeader ? (
        <CardHeader className="space-y-4 border-b border-slate-200/80 bg-gradient-to-r from-cyan-50/90 via-white to-white pb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div>
                <CardTitle className="text-slate-950">{title}</CardTitle>
                <CardDescription className="max-w-3xl text-slate-600">{description}</CardDescription>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ExecutiveMetric label="Perfiles visibles" value={String(candidates.length)} tone="slate" />
              <ExecutiveMetric label="Listos para mover" value={String(advanceCount)} tone="emerald" />
              <ExecutiveMetric label="A revisar" value={String(reviewCount)} tone="amber" />
              <ExecutiveMetric label="Score medio" value={`${averageTotalScore}/100`} tone="cyan" />
            </div>
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={`space-y-6 ${showExecutiveHeader ? 'p-5 sm:p-6 lg:p-7' : 'p-5 sm:p-6'}`}>
        {candidates.length === 0 ? (
          <EmptyState
            title="Sin candidatos cargados"
            description="Añade candidatos manualmente o espera la sincronización automática desde las evaluaciones completadas."
            icon={<UserRoundSearch className="h-6 w-6" />}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {shortlistedCount} en shortlist
              </span>
              <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {advanceCount} listos para mover
              </span>
              <span className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                {reviewCount} a revisar
              </span>
            </div>

            <div className="space-y-6">
              {candidatesWithDecision.map(({ candidate, decision }, index) => {
                const decisionMeta = getRecruiterDecisionMeta(decision.decision);
                const recommendationMeta = getVacancyRecommendationMeta(decision.recommendation);
                const isShortlistedManually = Boolean(candidate.shortlistManual);
                const readinessTone =
                  decision.readinessScore >= 78
                    ? 'bg-emerald-500'
                    : decision.readinessScore >= 60
                      ? 'bg-amber-500'
                      : 'bg-rose-500';

                return (
                  <div
                    key={candidate.id}
                    className="rounded-[28px] border border-slate-200/90 bg-white p-5 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.4)] transition hover:border-cyan-200 hover:shadow-[0_22px_45px_-32px_rgba(14,165,233,0.35)]"
                  >
                    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_320px]">
                      <div className="space-y-5">
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <Avatar name={candidate.name} index={index} />
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="space-y-1">
                                <p className="truncate text-lg font-semibold tracking-tight text-slate-950">{candidate.name}</p>
                                <p className="text-sm text-slate-600">
                                  {candidate.vacancy} · {candidate.department}
                                  {candidate.scoreProfileId ? ` · Score ${getVacancyScoreProfileLabel(candidate.scoreProfileId)}` : ''}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${decisionMeta.badgeClass}`}>
                                  {decision.label}
                                </span>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${recommendationMeta.badgeClass}`}>
                                  {recommendationMeta.shortLabel}
                                </span>
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  {candidate.status === 'rejected' ? 'No avanzar' : candidate.status === 'shortlisted' ? 'Shortlist' : candidate.status}
                                </span>
                                {isShortlistedManually ? (
                                  <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                                    {candidate.shortlistOrder ? `#${candidate.shortlistOrder} shortlist` : 'En shortlist'}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Datos clave</p>
                            <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                              <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Contacto</p>
                                <p className="mt-1 break-all font-medium text-slate-700">{candidate.email || 'Sin email'}</p>
                              </div>
                              <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ubicación</p>
                                <p className="mt-1 font-medium text-slate-700">{candidate.location || 'Sin ubicación'}</p>
                              </div>
                              <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-sm">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Actualizado</p>
                                <p className="mt-1 font-medium text-slate-700">{formatAdminDate(candidate.updatedAt)}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Readiness recruiter</p>
                              <p className="mt-1 text-sm text-slate-600">{decision.rationale}</p>
                            </div>
                            <div className="rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-right shadow-sm">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-700">Siguiente paso</p>
                              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900">{decision.nextStep}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center gap-3">
                            <div className="flex-1 overflow-hidden rounded-full bg-slate-200">
                              <div className={`h-2.5 rounded-full ${readinessTone}`} style={{ width: `${decision.readinessScore}%` }} />
                            </div>
                            <span className="text-sm font-semibold text-slate-900">{decision.readinessScore}/100</span>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-950">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-emerald-600" />
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Fortaleza guía</p>
                            </div>
                            <p className="mt-2 leading-relaxed">{decision.strengths[0] || 'Sin fortaleza dominante clara aún.'}</p>
                          </div>
                          <div className="rounded-[22px] border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-950">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Riesgo a validar</p>
                            </div>
                            <p className="mt-2 leading-relaxed">{decision.risks[0] || 'No surge un riesgo crítico en esta lectura.'}</p>
                          </div>
                          <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-800">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-cyan-700" />
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Foco táctico</p>
                            </div>
                            <p className="mt-2 leading-relaxed">
                              {decision.prompts[0]?.question || 'Validación general de criterio, consistencia y colaboración.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex min-h-full flex-col justify-between gap-4 rounded-[26px] border border-slate-200 bg-slate-50/80 p-5">
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <ExecutiveMetric label="Score total" value={scoreCell(candidate.totalScore)} tone="cyan" />
                            <ExecutiveMetric label="Readiness" value={`${decision.readinessScore}/100`} tone="slate" />
                            <ExecutiveMetric label="Técnico" value={scoreCell(candidate.technicalScore)} tone="slate" />
                            <ExecutiveMetric label="Cognitivo" value={scoreCell(candidate.cognitiveScore)} tone="slate" />
                            <ExecutiveMetric label="Soft skills" value={scoreCell(candidate.softSkillsScore)} tone="slate" />
                            <ExecutiveMetric label="Fuente" value={candidate.source === 'assessment' ? 'Assessment' : 'Manual'} tone="amber" />
                          </div>

                          <div className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-4 py-4 shadow-sm">
                            <div className="flex items-center gap-2 text-cyan-700">
                              <Gauge className="h-4 w-4" />
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Lectura ejecutiva</p>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-slate-700">
                              {isShortlistedManually
                                ? candidate.shortlistOrder
                                  ? `Ya está guardado en shortlist con prioridad #${candidate.shortlistOrder}.`
                                  : 'Ya está dentro de la shortlist manual y listo para orden final.'
                                : decision.decision === 'advance'
                                  ? 'Perfil con evidencia suficiente para mover rápido si la validación final acompaña.'
                                  : decision.decision === 'review'
                                    ? 'Conviene hacer una entrevista corta de contraste antes de decidir avance.'
                                    : 'No aparece suficiente evidencia para justificar movimiento inmediato.'}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Button
                            variant={isShortlistedManually ? 'outline' : 'default'}
                            className={
                              isShortlistedManually
                                ? 'w-full border-slate-200 text-slate-700'
                                : 'w-full bg-cyan-600 text-white hover:bg-cyan-500'
                            }
                            onClick={() => onToggleShortlistCandidate?.(candidate)}
                          >
                            {isShortlistedManually ? 'Quitar shortlist' : 'Guardar shortlist'}
                          </Button>
                          {decision.shortlistEligible && !isShortlistedManually ? (
                            <Button variant="outline" className="w-full border-cyan-200 text-cyan-700" onClick={() => onShortlistCandidate?.(candidate)}>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Priorizar ahora
                            </Button>
                          ) : null}
                          <Button variant="ghost" className="w-full text-cyan-700 hover:bg-cyan-50" onClick={() => onViewCandidate?.(candidate)}>
                            Ver detalle
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
