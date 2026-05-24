'use client';

import { useEffect, useState, useMemo } from 'react';
import { ArrowRight, CheckCircle2, ListOrdered, Sparkles, TriangleAlert, X, Bot, Loader2, Target, Shield, TrendingUp, Zap, Network, Crosshair, Scale } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  buildCandidateDecision,
  getRecruiterDecisionMeta,
} from '@/lib/admin-dashboard/recruiter-decisioning';
import type {
  CandidatePipelineStage,
  CandidateResult,
  CandidateStatus,
  JobOpening,
  VacancyRecommendation,
} from '@/types/admin-dashboard';
import type { MetricsMap } from '@/lib/types';
import { getVacancyScoreProfileLabel } from '@/lib/admin-dashboard/vacancy-scoring';
import { formatAdminDate, formatAdminDateTime } from '@/lib/utils';
import { deriveBehavioralInsights } from '@/lib/assessment/behavioral-insights';
import { CandidatePdfExportButton } from '@/components/admin-dashboard/candidate-pdf-preview';
import { SkillsGraphPanel } from '@/components/admin-dashboard/skills-graph-panel';

const realScoreRows = [
  ['Memoria', 'memory'],
  ['Gestión', 'leadership'],
  ['Crisis', 'problemSolving'],
  ['Ética', 'ethics'],
  ['Riesgo', 'risk'],
  ['Multitarea', 'network'],
  ['Estrategia', 'strategy'],
] as const;

const stageOptions: Array<{ value: CandidatePipelineStage; label: string }> = [
  { value: 'applied', label: 'Aplicado' },
  { value: 'screening', label: 'Filtro inicial' },
  { value: 'assessment', label: 'Evaluación' },
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
  jobs,
  assessmentRecords = [],
  onUpdateCandidate,
  isUpdatingCandidate = false,
}: {
  candidate: CandidateResult | null;
  onOpenChange: (next: boolean) => void;
  jobs: JobOpening[];
  assessmentRecords?: Array<{ id: string; metrics: Record<string, Record<string, number | string | boolean>> }>;
  onUpdateCandidate?: (payload: {
    id: string;
    status: CandidateStatus;
    pipelineStage: CandidatePipelineStage;
    vacancyId?: string;
    phone?: string;
    recruiterNotes?: string;
    shortlistManual?: boolean;
    vacancyRecommendation?: VacancyRecommendation;
  }) => void;
  isUpdatingCandidate?: boolean;
}) {
  const [statusDraft, setStatusDraft] = useState<CandidateStatus>('pending');
  const [stageDraft, setStageDraft] = useState<CandidatePipelineStage>('applied');
  const [vacancyDraft, setVacancyDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [shortlistDraft, setShortlistDraft] = useState(false);
  const [recommendationDraft, setRecommendationDraft] = useState<VacancyRecommendation>('reserve');
  const [isGeneratingMatch, setIsGeneratingMatch] = useState(false);
  const [aiMatchError, setAiMatchError] = useState('');
  const [localMatchScore, setLocalMatchScore] = useState<number | null>(null);
  const [localMatchReason, setLocalMatchReason] = useState<string | null>(null);

  useEffect(() => {
    if (!candidate) return;
    setStatusDraft(candidate.status);
    setStageDraft(candidate.pipelineStage);
    setVacancyDraft(candidate.vacancyId);
    setPhoneDraft(candidate.phone ?? '');
    setNotesDraft(candidate.recruiterNotes ?? '');
    setShortlistDraft(Boolean(candidate.shortlistManual));
    setRecommendationDraft(candidate.vacancyRecommendation ?? buildCandidateDecision(candidate).recommendation);

    setLocalMatchScore(candidate.aiMatchScore ?? null);
    setLocalMatchReason(candidate.aiMatchReason ?? null);
  }, [candidate]);

  const handleGenerateMatch = async () => {
    if (!candidate) return;
    const job = jobs.find(j => j.id === candidate.vacancyId);
    if (!job) {
      setAiMatchError("Vacante original no encontrada para el análisis.");
      return;
    }

    setIsGeneratingMatch(true);
    setAiMatchError('');

    try {
      const res = await fetch('/api/admin/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, job })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar Match Score');

      setLocalMatchScore(data.aiMatchScore);
      setLocalMatchReason(data.aiMatchReason);
    } catch(err: any) {
      setAiMatchError(err.message || 'Error occurred');
    } finally {
      setIsGeneratingMatch(false);
    }
  };

  const assessmentRecord = useMemo(
    () => (candidate?.assessmentId ? assessmentRecords.find((record) => record.id === candidate.assessmentId) : undefined),
    [assessmentRecords, candidate?.assessmentId]
  );

  const selectedJob = useMemo(() => {
    if (!candidate) return null;
    return jobs.find((job) => job.id === vacancyDraft) ?? jobs.find((job) => job.id === candidate.vacancyId) ?? null;
  }, [candidate, jobs, vacancyDraft]);

  if (!candidate) return null;
  const rawScores = candidate.rawScores;
  const overall = rawScores
    ? Math.round(realScoreRows.reduce((s, [, k]) => s + (rawScores[k] ?? 0), 0) / realScoreRows.length)
    : candidate.totalScore ?? 0;
  const decision = buildCandidateDecision(candidate);
  const decisionMeta = getRecruiterDecisionMeta(decision.decision);
  const compactStrengths = decision.strengths;
  const compactRisks = decision.risks;
  const compactPrompts = decision.prompts;

  const hasProgressChanges =
    statusDraft !== candidate.status ||
    stageDraft !== candidate.pipelineStage ||
    vacancyDraft !== candidate.vacancyId ||
    phoneDraft !== (candidate.phone ?? '') ||
    notesDraft !== (candidate.recruiterNotes ?? '') ||
    shortlistDraft !== Boolean(candidate.shortlistManual) ||
    recommendationDraft !== (candidate.vacancyRecommendation ?? decision.recommendation);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="candidate-detail-title">
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 my-2 flex w-full max-w-6xl flex-col bg-white shadow-2xl" style={{ maxHeight: 'calc(100vh - 1.5rem)' }}>

        {/* ENCABEZADO OPTIMIZADO */}
        <div className="flex items-start justify-between border-b border-slate-200/80 bg-slate-50/50 px-6 py-5">
          <div>
            <h2 id="candidate-detail-title" className="text-2xl font-bold text-slate-950">{candidate.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{candidate.vacancy}</span>
              <span className="text-slate-400">•</span>
              <span>{candidate.department}</span>
              <span className="text-slate-400">•</span>
              <span>{candidate.email}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white">Aplicó el {formatAdminDate(candidate.appliedAt)}</Badge>
              <Badge variant="outline" className="bg-white">Fuente: {candidate.source === 'assessment' ? 'Assessment' : 'Manual'}</Badge>
              {candidate.scoreProfileId && (
                <Badge variant="outline" className="bg-white">Score base: {getVacancyScoreProfileLabel(candidate.scoreProfileId)}</Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* CONTENIDO PRINCIPAL A 2 COLUMNAS */}
        <div className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden">

          {/* COLUMNA IZQUIERDA: RESULTADOS DEL TEST (Scroll interno) */}
          <div className="flex-1 overflow-y-auto bg-white p-6 overscroll-contain">

            {/* ÍNDICE GLOBAL */}
            <div className="grid gap-4 sm:grid-cols-3 mb-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Índice Global</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-slate-950">{overall}</p>
                  <p className="text-sm font-medium text-slate-400">/ 100</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Score Ponderado</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-slate-950">{candidate.totalScore ?? '--'}</p>
                  <p className="text-sm font-medium text-slate-400">/ 100</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Última actualización</p>
                <p className="mt-2 text-base font-semibold text-slate-700">{formatAdminDateTime(candidate.updatedAt)}</p>
              </div>
            </div>

            {/* PERFIL */}
            {(candidate.personalityProfile || candidate.strategyProfile || candidate.personalitySubtype) && (
              <div className="mb-8">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-900">Análisis de Perfil</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Arquetipo</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{candidate.personalityProfile || '--'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Subtipo DISC</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{candidate.personalitySubtype || '--'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Estrategia</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{candidate.strategyProfile || '--'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* AI MATCHMAKING WIDGET */}
            <div className="mb-8 overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-b from-violet-50/50 to-white shadow-sm ring-1 ring-inset ring-violet-100">
              <div className="flex items-center justify-between border-b border-violet-100/50 bg-white/40 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <Bot className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">AI Matchmaking</h3>
                </div>
                {localMatchScore !== null && (
                  <Badge className={localMatchScore >= 75 ? 'bg-emerald-500 hover:bg-emerald-600' : localMatchScore >= 50 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-600'}>
                    {localMatchScore}% Match
                  </Badge>
                )}
              </div>
              <div className="p-4 sm:p-5">
                {localMatchScore !== null ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed text-slate-700 italic border-l-2 border-violet-300 pl-3">
                      "{localMatchReason}"
                    </p>
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <Button variant="ghost" size="sm" onClick={handleGenerateMatch} disabled={isGeneratingMatch} className="text-violet-600 hover:bg-violet-50 h-8 text-xs font-semibold px-3">
                        {isGeneratingMatch ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                        {isGeneratingMatch ? 'Procesando...' : 'Regenerar Análisis'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-slate-600">
                      Calcula la afinidad entre el perfil psicológico y los requisitos de la vacante utilizando Inteligencia Artificial.
                    </p>
                    {aiMatchError && <p className="text-xs text-red-500 font-medium">{aiMatchError}</p>}
                    <Button onClick={handleGenerateMatch} disabled={isGeneratingMatch} className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all shadow-violet-200">
                      {isGeneratingMatch ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analizando candidato...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generar Análisis de Afinidad
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <SkillsGraphPanel
              candidate={candidate}
              job={selectedJob}
              metrics={assessmentRecord?.metrics as Partial<MetricsMap> | undefined}
            />

            {/* EVALUACIÓN DE SISTEMA */}
            <div className={`mb-8 overflow-hidden rounded-2xl border ${decisionMeta.surfaceClass}`}>
              <div className="bg-white/50 p-4 border-b border-current/10">
                <div className="flex items-center gap-3">
                  <Badge className={decisionMeta.badgeClass}>{decision.label}</Badge>
                  <span className="text-sm font-medium text-slate-700">Recomendación del sistema</span>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <p className="text-sm leading-relaxed text-slate-800">{decision.rationale}</p>
              </div>
            </div>

            {/* TRES PILARES DE EVALUACIÓN */}
            <div className="grid gap-4 xl:grid-cols-3 mb-10">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-bold text-slate-900">Señales para aprovechar</p>
                </div>
                <div className="space-y-2">
                  {compactStrengths.length ? compactStrengths.map((item) => (
                    <p key={item} className="text-sm text-slate-600 leading-relaxed">• {item}</p>
                  )) : (
                    <p className="text-sm text-slate-400 italic">No hay fortalezas evidentes detectadas en los resultados.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-bold text-slate-900">Riesgos a validar</p>
                </div>
                <div className="space-y-2">
                  {compactRisks.length ? compactRisks.map((item) => (
                    <p key={item} className="text-sm text-slate-600 leading-relaxed">• {item}</p>
                  )) : (
                    <p className="text-sm text-slate-400 italic">No se detectaron riesgos altos para esta posición.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-600" />
                  <p className="text-sm font-bold text-slate-900">Foco Táctico</p>
                </div>
                <div className="space-y-3">
                  {compactPrompts.map((prompt) => (
                    <div key={prompt.title}>
                      <p className="text-xs font-semibold text-slate-800 mb-1">{prompt.title}</p>
                      <p className="text-xs text-slate-500">{prompt.question}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* DESGLOSE DE COMPETENCIAS — Dimensiones reales del test */}
            {rawScores ? (
              <div>
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">Resultados por Evaluación</h3>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {realScoreRows.map(([label, key]) => {
                    const v = rawScores[key] ?? 0;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-700">{label}</span>
                          <span className="font-[family:var(--font-admin-mono)] text-slate-500">{v}/100</span>
                        </div>
                        <Progress value={v} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* SEÑALES DE COMPORTAMIENTO */}
            {(() => {
              if (!candidate.assessmentId) return null;
              if (!assessmentRecord?.metrics) return null;
              const insights = deriveBehavioralInsights(assessmentRecord.metrics as any);
              if (!insights.length) return null;

              const ICON_MAP: Record<string, typeof Target> = { Target, Shield, TrendingUp, Zap, Network, Crosshair, Scale };
              const signalStyles: Record<string, string> = {
                positive: 'border-emerald-200/80 bg-emerald-50/50 text-emerald-700',
                neutral: 'border-slate-200/80 bg-slate-50/50 text-slate-600',
                caution: 'border-amber-200/80 bg-amber-50/50 text-amber-700',
              };
              const dotStyles: Record<string, string> = {
                positive: 'bg-emerald-400',
                neutral: 'bg-slate-400',
                caution: 'bg-amber-400',
              };

              return (
                <div className="mt-8">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-900">Señales de Comportamiento</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {insights.map((insight) => {
                      const IconComponent = ICON_MAP[insight.icon] || Target;
                      return (
                        <div
                          key={insight.id}
                          className={`group relative rounded-xl border p-3.5 transition-all hover:shadow-sm ${signalStyles[insight.signal]}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 border border-current/10 shadow-sm">
                              <IconComponent className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{insight.label}</p>
                                <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[insight.signal]}`} />
                              </div>
                              <p className="mt-0.5 text-sm font-semibold">{insight.value}</p>
                              <p className="mt-1 text-[11px] leading-relaxed opacity-70">{insight.detail}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

          </div>

          {/* COLUMNA DERECHA: PIPELINE RECRUITER */}
          <div className="w-full lg:w-[380px] shrink-0 border-l border-slate-200 bg-slate-50/50 flex flex-col min-h-0 lg:max-h-full">
            <div className="flex-1 overflow-y-auto overscroll-contain p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-6">Acción Recruiter</h3>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Vacante de interés</label>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    value={vacancyDraft}
                    onChange={(e) => setVacancyDraft(e.target.value)}
                  >
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>{job.title} · {job.department}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Etapa en Pipeline</label>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      value={stageDraft}
                      onChange={(e) => setStageDraft(e.target.value as CandidatePipelineStage)}
                    >
                      {stageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Estado global</label>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value as CandidateStatus)}
                    >
                      {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Decisión Recruiter / Recomendación</label>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    value={recommendationDraft}
                    onChange={(e) => setRecommendationDraft(e.target.value as VacancyRecommendation)}
                  >
                    <option value="recommended">Avanzar - Recomendado</option>
                    <option value="reserve">Hold - Reserva manual</option>
                    <option value="no-advance">Rechazar - No avanzar</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Teléfono (Opcional)</label>
                  <input
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="+598 99 xxx xxx"
                  />
                </div>

                {/* BOTÓN THE SHORTLIST */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShortlistDraft(!shortlistDraft)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 transition-colors ${shortlistDraft ? 'bg-cyan-50 border-cyan-200 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${shortlistDraft ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <ListOrdered className="h-4 w-4" />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${shortlistDraft ? 'text-cyan-900' : 'text-slate-700'}`}>Shortlist prioritario</p>
                        <p className="text-xs text-slate-500">{shortlistDraft ? 'El perfil se mantendrá guardado' : 'Guardar perfil destacado'}</p>
                      </div>
                    </div>
                    <div className={`h-5 w-5 rounded border flex items-center justify-center ${shortlistDraft ? 'bg-cyan-500 border-cyan-500' : 'bg-white border-slate-300'}`}>
                      {shortlistDraft && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Registro de Selección (Notas)</label>
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Escribe observaciones, acuerdos salariales, o justificación para pasarlo a siguiente etapa..."
                  />
                </div>
              </div>
            </div>

            {/* BOTÓN GUARDAR + PDF - Siempre visible */}
            <div className="shrink-0 border-t border-slate-200 bg-white p-4 space-y-2">
               <CandidatePdfExportButton
                 candidate={candidate}
                 assessmentMetrics={assessmentRecord?.metrics}
               />
               <Button
                  className="w-full h-12 text-sm font-bold shadow-md"
                  onClick={() =>
                    onUpdateCandidate?.({
                      id: candidate.id,
                      status: statusDraft,
                      pipelineStage: stageDraft,
                      vacancyId: vacancyDraft,
                      phone: phoneDraft,
                      recruiterNotes: notesDraft,
                      shortlistManual: shortlistDraft,
                      vacancyRecommendation: recommendationDraft,
                    })
                  }
                  disabled={!hasProgressChanges || isUpdatingCandidate}
                >
                {isUpdatingCandidate ? 'Registrando...' : 'Guardar Progreso'}
                </Button>
            </div>

          </div>
        </div>
      </Card>
    </div>
  );
}
