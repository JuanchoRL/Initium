import type {
  CandidateFitScores,
  CandidatePipelineStage,
  CandidateResult,
  CandidateStatus,
  VacancyRecommendation,
} from '@/types/admin-dashboard';

export type RecruiterDecision = 'advance' | 'review' | 'decline';

export type InterviewPrompt = {
  title: string;
  question: string;
  signal: string;
};

export type CandidateDecisionSummary = {
  decision: RecruiterDecision;
  recommendation: VacancyRecommendation;
  label: string;
  shortLabel: string;
  rationale: string;
  nextStep: string;
  shortlistEligible: boolean;
  readinessScore: number;
  strengths: string[];
  risks: string[];
  prompts: InterviewPrompt[];
  suggestedStatus: CandidateStatus;
  suggestedStage: CandidatePipelineStage;
};

type ScoreSnapshot = {
  technical: number;
  cognitive: number;
  behavioral: number;
  communication: number;
  leadership: number;
  culture: number;
  total: number;
};

const DECISION_META: Record<RecruiterDecision, { label: string; shortLabel: string; badgeClass: string; surfaceClass: string }> = {
  advance: {
    label: 'Avanzar',
    shortLabel: 'Avanzar',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    surfaceClass: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
  },
  review: {
    label: 'Revisar',
    shortLabel: 'Revisar',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    surfaceClass: 'border-amber-200 bg-amber-50/70 text-amber-900',
  },
  decline: {
    label: 'No avanzar',
    shortLabel: 'No avanzar',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    surfaceClass: 'border-rose-200 bg-rose-50/70 text-rose-900',
  },
};

const RECOMMENDATION_META: Record<
  VacancyRecommendation,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    surfaceClass: string;
    emphasis: string;
  }
> = {
  recommended: {
    label: 'Recomendado',
    shortLabel: 'Recomendado',
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    surfaceClass: 'border-cyan-200 bg-cyan-50/70 text-cyan-900',
    emphasis: 'Listo para competir por esta vacante.',
  },
  reserve: {
    label: 'Reserva',
    shortLabel: 'Reserva',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    surfaceClass: 'border-amber-200 bg-amber-50/70 text-amber-900',
    emphasis: 'Conviene retenerlo en el radar, pero no como primera opción.',
  },
  'no-advance': {
    label: 'No avanzar',
    shortLabel: 'No avanzar',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    surfaceClass: 'border-rose-200 bg-rose-50/70 text-rose-900',
    emphasis: 'No muestra suficiente ajuste para esta vacante.',
  },
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeScores(candidate: CandidateResult): ScoreSnapshot {
  const fit = candidate.fitScores;
  const technical = fit?.technicalMatch ?? candidate.technicalScore ?? 0;
  const cognitive = fit?.cognitivePerformance ?? candidate.cognitiveScore ?? 0;
  const behavioral = fit?.behavioralFit ?? candidate.softSkillsScore ?? 0;
  const communication = fit?.communication ?? candidate.softSkillsScore ?? 0;
  const leadership = fit?.leadershipPotential ?? averageValues([behavioral, communication]);
  const culture = fit?.cultureFit ?? behavioral;
  const total = candidate.totalScore ?? averageValues([technical, cognitive, behavioral]);

  return {
    technical: clamp(technical),
    cognitive: clamp(cognitive),
    behavioral: clamp(behavioral),
    communication: clamp(communication),
    leadership: clamp(leadership),
    culture: clamp(culture),
    total: clamp(total),
  };
}

function averageValues(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectStrengths(scores: ScoreSnapshot) {
  const strengths: string[] = [];
  if (scores.technical >= 78) strengths.push(`Ajuste técnico sólido (${scores.technical}/100).`);
  if (scores.cognitive >= 78) strengths.push(`Buen criterio cognitivo (${scores.cognitive}/100).`);
  if (scores.behavioral >= 76) strengths.push(`Señal conductual consistente (${scores.behavioral}/100).`);
  if (scores.communication >= 76) strengths.push(`Comunicación clara y usable (${scores.communication}/100).`);
  if (scores.leadership >= 76) strengths.push(`Potencial de coordinación visible (${scores.leadership}/100).`);
  if (scores.culture >= 76) strengths.push(`Ajuste cultural favorable (${scores.culture}/100).`);
  return strengths.slice(0, 3);
}

function collectRisks(scores: ScoreSnapshot) {
  const risks: string[] = [];
  if (scores.technical <= 54) risks.push(`Debe validar base técnica (${scores.technical}/100).`);
  if (scores.cognitive <= 54) risks.push(`Conviene validar estructura y criterio (${scores.cognitive}/100).`);
  if (scores.behavioral <= 54) risks.push(`Hay dudas sobre respuesta conductual (${scores.behavioral}/100).`);
  if (scores.communication <= 54) risks.push(`La comunicación necesita contraste en vivo (${scores.communication}/100).`);
  if (scores.leadership <= 54) risks.push(`Priorización y coordinación todavía débiles (${scores.leadership}/100).`);
  if (scores.culture <= 54) risks.push(`Puede requerir validación de encaje con el equipo (${scores.culture}/100).`);
  return risks.slice(0, 3);
}

function buildPrompts(scores: ScoreSnapshot): InterviewPrompt[] {
  const prompts: InterviewPrompt[] = [];

  if (scores.communication <= 65) {
    prompts.push({
      title: 'Claridad de comunicación',
      question: 'Pídele que explique una situación compleja en tres pasos: contexto, acción y resultado.',
      signal: 'Esperamos orden, síntesis y mensajes accionables sin perder información clave.',
    });
  }

  if (scores.behavioral <= 65 || scores.culture <= 65) {
    prompts.push({
      title: 'Trabajo con otros',
      question: 'Pídele un ejemplo real de conflicto o desacuerdo dentro de un equipo y cómo lo resolvió.',
      signal: 'Buscamos empatía, responsabilidad compartida y capacidad de bajar tensión.',
    });
  }

  if (scores.technical <= 65) {
    prompts.push({
      title: 'Profundidad técnica',
      question: 'Pídele que detalle una decisión técnica reciente: opciones, criterio y trade-offs elegidos.',
      signal: 'Debe justificar decisiones con lógica y no solo con resultados superficiales.',
    });
  }

  if (scores.cognitive <= 65) {
    prompts.push({
      title: 'Estructura bajo presión',
      question: 'Dale un mini caso ambiguo y pídele que priorice qué haría primero, segundo y tercero.',
      signal: 'Buscamos secuencia lógica, foco y descarte de ruido.',
    });
  }

  if (scores.leadership >= 75) {
    prompts.push({
      title: 'Escalamiento de liderazgo',
      question: 'Pregúntale cómo repartiría trabajo en un equipo sobrecargado sin perder calidad.',
      signal: 'Queremos ver criterio, balance de carga y lectura del contexto.',
    });
  }

  if (!prompts.length) {
    prompts.push({
      title: 'Validación general',
      question: 'Repasa un caso breve y pídele que ordene respuesta, riesgos y seguimiento.',
      signal: 'Debe mostrar criterio, claridad y consistencia con lo observado en el assessment.',
    });
  }

  return prompts.slice(0, 3);
}

function resolveSuggestedStage(current: CandidatePipelineStage, decision: RecruiterDecision): CandidatePipelineStage {
  if (decision === 'decline') return current;
  if (decision === 'advance') {
    if (current === 'final-review' || current === 'hired') return current;
    return 'interview';
  }
  if (current === 'applied') return 'screening';
  return current;
}

function resolveSuggestedStatus(current: CandidateStatus, decision: RecruiterDecision): CandidateStatus {
  if (current === 'hired') return current;
  if (decision === 'advance') return 'shortlisted';
  if (decision === 'decline') return 'rejected';
  return 'active';
}

export function buildCandidateDecision(candidate: CandidateResult): CandidateDecisionSummary {
  const scores = normalizeScores(candidate);
  const strengths = collectStrengths(scores);
  const risks = collectRisks(scores);
  const lowSignals = [scores.technical, scores.cognitive, scores.behavioral, scores.communication].filter((value) => value <= 54).length;
  const strongSignals = [scores.technical, scores.cognitive, scores.behavioral, scores.communication, scores.leadership, scores.culture].filter((value) => value >= 76).length;

  let decision: RecruiterDecision = 'review';
  if (candidate.status === 'rejected') {
    decision = 'decline';
  } else if (scores.total >= 78 && lowSignals === 0 && scores.communication >= 60 && scores.behavioral >= 60) {
    decision = 'advance';
  } else if (scores.total < 52 || lowSignals >= 3) {
    decision = 'decline';
  }

  const readinessBase = scores.total * 0.55 + scores.communication * 0.15 + scores.behavioral * 0.15 + scores.cognitive * 0.15;
  const readinessScore = clamp(
    readinessBase +
      (decision === 'advance' ? 8 : 0) -
      (decision === 'decline' ? 12 : 0) +
      strongSignals * 1.5 -
      lowSignals * 4
  );

  const rationale =
    decision === 'advance'
      ? `El perfil tiene suficiente consistencia para pasar a entrevista: score total ${scores.total}/100 con señales útiles en ${strengths.length ? strengths[0].toLowerCase() : 'múltiples dimensiones clave'}.`
      : decision === 'decline'
        ? `Las señales actuales no alcanzan para avanzar: score total ${scores.total}/100 y varios frentes necesitan validación fuerte antes de mover el proceso.`
        : `Hay señales interesantes, pero todavía conviene revisar antes de decidir: score total ${scores.total}/100 con mezcla de fortalezas y riesgos.`;

  const nextStep =
    decision === 'advance'
      ? 'Mover a shortlist y abrir entrevista estructurada con foco en confirmación.'
      : decision === 'decline'
        ? 'No avanzar por ahora o pedir evidencia adicional solo si la vacante es difícil de cubrir.'
        : 'Mantener en revisión corta y validar los puntos débiles en una entrevista breve o screening adicional.';

  const recommendation = resolveVacancyRecommendation(candidate, decision);

  return {
    decision,
    recommendation,
    label: DECISION_META[decision].label,
    shortLabel: DECISION_META[decision].shortLabel,
    rationale,
    nextStep,
    shortlistEligible: decision === 'advance' && candidate.status !== 'shortlisted' && candidate.status !== 'hired',
    readinessScore,
    strengths,
    risks,
    prompts: buildPrompts(scores),
    suggestedStatus: resolveSuggestedStatus(candidate.status, decision),
    suggestedStage: resolveSuggestedStage(candidate.pipelineStage, decision),
  };
}

export function getRecruiterDecisionMeta(decision: RecruiterDecision) {
  return DECISION_META[decision];
}

export function getVacancyRecommendationMeta(recommendation: VacancyRecommendation) {
  return RECOMMENDATION_META[recommendation];
}

export function resolveVacancyRecommendation(
  candidate: CandidateResult,
  decisionOverride?: RecruiterDecision
): VacancyRecommendation {
  if (candidate.vacancyRecommendation) return candidate.vacancyRecommendation;
  if (candidate.shortlistManual) return 'recommended';

  const decision = decisionOverride ?? buildCandidateDecision(candidate).decision;
  if (decision === 'advance') return 'recommended';
  if (decision === 'review') return 'reserve';
  return 'no-advance';
}

export function sortCandidatesForDecision(candidates: CandidateResult[]) {
  return [...candidates].sort((left, right) => {
    const leftDecision = buildCandidateDecision(left);
    const rightDecision = buildCandidateDecision(right);
    const priorityMap: Record<RecruiterDecision, number> = { advance: 0, review: 1, decline: 2 };
    if (priorityMap[leftDecision.decision] !== priorityMap[rightDecision.decision]) {
      return priorityMap[leftDecision.decision] - priorityMap[rightDecision.decision];
    }
    if (Boolean(left.shortlistManual) !== Boolean(right.shortlistManual)) {
      return left.shortlistManual ? -1 : 1;
    }
    const recommendationPriority: Record<VacancyRecommendation, number> = {
      recommended: 0,
      reserve: 1,
      'no-advance': 2,
    };
    if (recommendationPriority[leftDecision.recommendation] !== recommendationPriority[rightDecision.recommendation]) {
      return recommendationPriority[leftDecision.recommendation] - recommendationPriority[rightDecision.recommendation];
    }
    if (rightDecision.readinessScore !== leftDecision.readinessScore) {
      return rightDecision.readinessScore - leftDecision.readinessScore;
    }
    return (right.totalScore ?? 0) - (left.totalScore ?? 0);
  });
}

export function describeComparisonLead(candidate: CandidateResult, peers: CandidateResult[]) {
  const candidateTotal = candidate.totalScore ?? 0;
  const peerAverage = peers.length ? averageValues(peers.map((peer) => peer.totalScore ?? 0)) : candidateTotal;
  const delta = Math.round(candidateTotal - peerAverage);
  if (delta >= 8) return `Está ${delta} puntos por encima del promedio del grupo visible.`;
  if (delta <= -8) return `Está ${Math.abs(delta)} puntos por debajo del promedio del grupo visible.`;
  return 'Está en el rango medio del grupo visible.';
}
