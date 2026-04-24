import { useState } from 'react';
import { BriefcaseBusiness, Edit2, FileText, UsersRound, Sparkles, Loader2, Bot } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CandidateResult, JobOpeningWithStats, JobStatus } from '@/types/admin-dashboard';
import { EmptyState } from '@/components/admin-dashboard/empty-state';
import { StatusBadge } from '@/components/admin-dashboard/status-badge';
import { formatAdminDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

const JOB_STATUS_OPTIONS: Array<{ value: JobStatus; label: string }> = [
  { value: 'active', label: 'Activa' },
  { value: 'on-hold', label: 'On hold' },
  { value: 'closed', label: 'Cerrada' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'draft', label: 'Borrador' },
];

function groupCandidatesByStatus(jobCandidates: CandidateResult[]) {
  const groups: Record<string, CandidateResult[]> = {
    'Test enviado': [],
    'En progreso': [],
    'Completado': [],
    'Rechazados': [],
  };

  jobCandidates.forEach((c) => {
    if (c.status === 'rejected') {
      groups['Rechazados'].push(c);
    } else if (c.pipelineStage === 'assessment') {
      groups['En progreso'].push(c);
    } else if (c.pipelineStage === 'final-review' || c.pipelineStage === 'hired' || c.status === 'shortlisted' || c.status === 'hired') {
      groups['Completado'].push(c);
    } else {
      groups['Test enviado'].push(c);
    }
  });

  return groups;
}

export function ActiveJobsTable({
  jobs,
  candidates = [],
  allCandidates = [],
  onUpdateJob,
  onEditJob,
}: {
  jobs: JobOpeningWithStats[];
  candidates?: CandidateResult[];
  allCandidates?: CandidateResult[];
  onUpdateJob?: (job: JobOpeningWithStats, updates: { status?: JobStatus }) => void;
  onEditJob?: (job: JobOpeningWithStats) => void;
}) {
  const [isRanking, setIsRanking] = useState<Record<string, boolean>>({});
  const [rankingError, setRankingError] = useState<Record<string, string>>({});
  // AI scores are keyed by JOB ID → candidate ID, so each vacancy gets its own ranking
  const [aiScoresByJob, setAiScoresByJob] = useState<Record<string, Record<string, { score: number; reason: string }>>>({});

  const candidatesForAi = allCandidates.length > 0 ? allCandidates : candidates;

  const handleRankJob = async (job: JobOpeningWithStats) => {
    // Only allow ranking if job has a description
    if (!job.jobDescription?.trim()) {
      setRankingError(prev => ({ ...prev, [job.id]: 'Carga una Job Description primero para que la IA pueda evaluar a los candidatos.' }));
      return;
    }

    setIsRanking(prev => ({ ...prev, [job.id]: true }));
    setRankingError(prev => ({ ...prev, [job.id]: '' }));
    try {
      const canddsToRank = candidatesForAi.filter(c => c.status !== 'rejected');
      const res = await fetch('/api/admin/jobs/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: canddsToRank, job })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al rankear');

      // Store results keyed by THIS job's ID — each vacancy gets its own ranking
      const jobScores: Record<string, { score: number; reason: string }> = {};
      if (data.rankResults && Array.isArray(data.rankResults)) {
        for (const r of data.rankResults) {
          jobScores[r.candidateId] = { score: r.aiMatchScore, reason: r.aiMatchReason };
        }
      }
      setAiScoresByJob(prev => ({ ...prev, [job.id]: jobScores }));
    } catch (err: any) {
      setRankingError(prev => ({ ...prev, [job.id]: err.message }));
    } finally {
      setIsRanking(prev => ({ ...prev, [job.id]: false }));
    }
  };

  const getAiScoreForJob = (jobId: string, c: CandidateResult): number | null =>
    aiScoresByJob[jobId]?.[c.id]?.score ?? null;
  const getAiReasonForJob = (jobId: string, c: CandidateResult): string | null =>
    aiScoresByJob[jobId]?.[c.id]?.reason ?? null;

  return (
    <Card className="overflow-hidden border-slate-200/90 bg-white shadow-[0_18px_40px_-28px_rgba(14,165,233,0.2)]">
      <CardHeader className="border-b border-slate-200/80 bg-gradient-to-r from-cyan-50/90 via-white to-white">
        <div>
          <CardTitle>Vacantes</CardTitle>
          <CardDescription>Lectura ejecutiva por rol, con estado operativo, volumen de evaluación y señales para decidir foco.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {jobs.length === 0 ? (
          <EmptyState
            title="No hay vacantes todavía"
            description="Crea la primera vacante del workspace para empezar a capturar candidatos y resultados."
            icon={<BriefcaseBusiness className="h-6 w-6" />}
          />
        ) : (
          jobs.map((job) => {
            const jobCandidates = candidates.filter((c) => c.vacancyId === job.id);
            const candidateGroups = groupCandidatesByStatus(jobCandidates);
            const hasJobDescription = Boolean(job.jobDescription?.trim());

            // Build ranked list for THIS specific job
            const rankedAll = candidatesForAi
              .filter(c => c.status !== 'rejected')
              .map(c => ({ candidate: c, score: getAiScoreForJob(job.id, c) }))
              .filter(item => item.score !== null && item.score !== undefined)
              .sort((a, b) => (b.score || 0) - (a.score || 0));
            const hasRankResults = rankedAll.length > 0;

            return (
              <div
                key={job.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tracking-tight text-slate-950">{job.title}</p>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {job.department} · {job.location} · Publicada el {formatAdminDate(job.postedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={job.status}
                      onChange={(event) => onUpdateJob?.(job, { status: event.target.value as JobStatus })}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      {JOB_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditJob?.(job)}
                      className="border-slate-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                  </div>
                </div>

                {/* Content grid */}
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  {/* Left: Job description */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-cyan-700" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">Job description</p>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {job.jobDescription?.trim() ? job.jobDescription.trim().slice(0, 400) : 'Aún no se cargó una job description para esta vacante.'}
                      {job.jobDescription && job.jobDescription.trim().length > 400 ? '…' : ''}
                    </p>
                  </div>

                  {/* Right: Pipeline by status */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-cyan-700">
                        <UsersRound className="h-4 w-4" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Pipeline</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                        {jobCandidates.length} asignados
                      </span>
                    </div>
                    <div className="grid gap-2 grid-cols-2">
                      {Object.entries(candidateGroups).map(([groupTitle, members]) => (
                        <div key={groupTitle} className="rounded-lg bg-white border border-slate-200/60 p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{groupTitle}</h4>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{members.length}</span>
                          </div>
                          <div className="space-y-1 max-h-[120px] overflow-y-auto">
                            {members.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">Sin candidatos</p>
                            ) : (
                              members.map((c) => (
                                <div key={c.id} className="flex items-center gap-1.5 rounded-md bg-slate-50/80 p-1 border border-slate-100">
                                  <Avatar name={c.name} size="sm" className="h-5 w-5 text-[9px] shrink-0" />
                                  <p className="truncate text-[10px] font-medium text-slate-800">{c.name}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Match Rank Section — unique per vacancy based on its job description */}
                <div className="mt-4 rounded-xl border border-violet-200/60 bg-gradient-to-b from-violet-50/40 to-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-violet-600" />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">IA Match Rank</p>
                      <span className="text-[9px] text-violet-500 font-medium">
                        {hasJobDescription ? 'Evalúa candidatos vs. Job Description' : 'Requiere Job Description'}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleRankJob(job)}
                      disabled={isRanking[job.id] || !hasJobDescription || candidatesForAi.length === 0}
                      variant="outline"
                      size="sm"
                      className={`h-7 px-3 text-[10px] font-semibold transition-all ${hasJobDescription ? 'border-violet-300 text-violet-700 hover:bg-violet-100' : 'border-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      {isRanking[job.id] ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                      {isRanking[job.id] ? 'Rankeando...' : 'Rankear con IA'}
                    </Button>
                  </div>
                  {rankingError[job.id] && (
                    <p className="text-[10px] text-red-500 font-medium mb-2">{rankingError[job.id]}</p>
                  )}
                  {!hasJobDescription ? (
                    <p className="text-[10px] text-amber-600 italic">
                      ⚠️ Carga una Job Description en esta vacante para habilitar el ranking con IA. Sin ella, la IA no puede evaluar la afinidad de los candidatos.
                    </p>
                  ) : hasRankResults ? (
                    <div className="space-y-1 max-h-[250px] overflow-y-auto">
                      {rankedAll.slice(0, 15).map(({ candidate: c, score }, idx) => {
                        const reason = getAiReasonForJob(job.id, c);
                        const isAssigned = c.vacancyId === job.id;
                        return (
                          <div key={c.id} className={`flex items-center justify-between gap-2 rounded-lg p-2 border group relative transition-all ${isAssigned ? 'bg-violet-50/60 border-violet-200' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-bold text-slate-400 w-4 text-right shrink-0">#{idx + 1}</span>
                              <Avatar name={c.name} size="sm" className="h-5 w-5 text-[9px] shrink-0" />
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-medium text-slate-800">{c.name}</p>
                                <p className="truncate text-[9px] text-slate-400">
                                  {isAssigned ? 'Asignado a esta vacante' : `${c.vacancy}`}
                                </p>
                              </div>
                            </div>
                            <div className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${(score || 0) >= 75 ? 'bg-emerald-100 text-emerald-700' : (score || 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              <Bot className="h-2.5 w-2.5" />
                              {score}%
                            </div>
                            {reason && (
                              <div className="absolute opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 w-52 p-2.5 text-[10px] bg-slate-800 text-slate-100 rounded-lg -top-2 left-full ml-2 shadow-xl whitespace-normal break-words leading-relaxed">
                                {reason}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {rankedAll.length > 15 && (
                        <p className="text-[10px] text-slate-400 text-center pt-1">y {rankedAll.length - 15} candidatos más evaluados…</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">
                      Presiona "Rankear con IA" para evaluar a todos los candidatos del workspace frente a esta Job Description.
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
