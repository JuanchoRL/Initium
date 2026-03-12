import { ArrowUpRight, Sparkles, UserRoundSearch } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CandidateResult } from '@/types/admin-dashboard';
import { EmptyState } from '@/components/admin-dashboard/empty-state';
import { StatusBadge } from '@/components/admin-dashboard/status-badge';
import {
  buildCandidateDecision,
  getRecruiterDecisionMeta,
  getVacancyRecommendationMeta,
} from '@/lib/admin-dashboard/recruiter-decisioning';
import { getVacancyScoreProfileLabel } from '@/lib/admin-dashboard/vacancy-scoring';
import { formatAdminDate } from '@/lib/utils';

const scoreCell = (value: number | null) => (value == null ? '--' : String(value));

export function CandidateResultsTable({
  candidates,
  title = 'Resultados de evaluación',
  description = 'Perfiles cargados manualmente o sincronizados automáticamente desde el assessment.',
  onViewCandidate,
  onShortlistCandidate,
  onToggleShortlistCandidate,
}: {
  candidates: CandidateResult[];
  title?: string;
  description?: string;
  onViewCandidate?: (candidate: CandidateResult) => void;
  onShortlistCandidate?: (candidate: CandidateResult) => void;
  onToggleShortlistCandidate?: (candidate: CandidateResult) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-4">
        {candidates.length === 0 ? (
          <div className="px-6 pb-6">
            <EmptyState
              title="Sin candidatos cargados"
              description="Añade candidatos manualmente o espera la sincronización automática desde las evaluaciones completadas."
              icon={<UserRoundSearch className="h-6 w-6" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-y border-slate-200/80 bg-slate-50/90 text-xs uppercase tracking-[0.16em] text-slate-400 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Nombre</th>
                  <th className="px-6 py-4 font-medium">Vacante</th>
                  <th className="px-6 py-4 font-medium">Score total</th>
                  <th className="px-6 py-4 font-medium">Score técnico</th>
                  <th className="px-6 py-4 font-medium">Score cognitivo</th>
                  <th className="px-6 py-4 font-medium">Soft skills</th>
                  <th className="px-6 py-4 font-medium">Decisión sugerida</th>
                  <th className="px-6 py-4 font-medium">Recomendación vacante</th>
                  <th className="px-6 py-4 font-medium">Shortlist manual</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Fecha</th>
                  <th className="px-6 py-4 text-right font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {candidates.map((candidate, index) => {
                  const decision = buildCandidateDecision(candidate);
                  const decisionMeta = getRecruiterDecisionMeta(decision.decision);
                  const recommendationMeta = getVacancyRecommendationMeta(decision.recommendation);
                  const isShortlistedManually = Boolean(candidate.shortlistManual);
                  return (
                    <tr key={candidate.id} className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-900/70">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={candidate.name} index={index} />
                          <div>
                            <div className="font-medium text-slate-950 dark:text-white">{candidate.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{candidate.email || candidate.location || 'Sin email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700 dark:text-slate-200">{candidate.vacancy}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {candidate.department}
                          {candidate.scoreProfileId ? ` · Score ${getVacancyScoreProfileLabel(candidate.scoreProfileId)}` : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-[family:var(--font-admin-mono)] font-semibold text-slate-950 dark:text-white">{scoreCell(candidate.totalScore)}</td>
                      <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-slate-600 dark:text-slate-300">{scoreCell(candidate.technicalScore)}</td>
                      <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-slate-600 dark:text-slate-300">{scoreCell(candidate.cognitiveScore)}</td>
                      <td className="px-6 py-4 font-[family:var(--font-admin-mono)] text-slate-600 dark:text-slate-300">{scoreCell(candidate.softSkillsScore)}</td>
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${decisionMeta.badgeClass}`}>
                            {decision.label}
                          </span>
                          <p className="max-w-[230px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">{decision.nextStep}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${recommendationMeta.badgeClass}`}>
                            {recommendationMeta.shortLabel}
                          </span>
                          <p className="max-w-[200px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {candidate.vacancyRecommendationSource === 'manual' ? 'Definida manualmente por recruiter.' : recommendationMeta.emphasis}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            isShortlistedManually
                              ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                          }`}
                        >
                          {isShortlistedManually ? 'En shortlist' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={candidate.status} /></td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatAdminDate(candidate.updatedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={isShortlistedManually ? 'border-slate-200 text-slate-700' : 'border-cyan-200 text-cyan-700'}
                            onClick={() => onToggleShortlistCandidate?.(candidate)}
                          >
                            {isShortlistedManually ? 'Quitar shortlist' : 'Guardar shortlist'}
                          </Button>
                          {decision.shortlistEligible && !isShortlistedManually ? (
                            <Button variant="outline" size="sm" className="border-cyan-200 text-cyan-700" onClick={() => onShortlistCandidate?.(candidate)}>
                              <Sparkles className="h-4 w-4" />
                              Priorizar
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" className="text-cyan-600 dark:text-cyan-300" onClick={() => onViewCandidate?.(candidate)}>
                            Ver detalle
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
