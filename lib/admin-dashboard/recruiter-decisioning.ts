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
  memory: number;
  leadership: number;
  problemSolving: number;
  ethics: number;
  risk: number;
  network: number;
  strategy: number;
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
  const raw = candidate.rawScores;
  const memory = raw?.memory ?? 0;
  const leadership = raw?.leadership ?? 0;
  const problemSolving = raw?.problemSolving ?? 0;
  const ethics = raw?.ethics ?? 0;
  const risk = raw?.risk ?? 0;
  const network = raw?.network ?? 0;
  const strategy = raw?.strategy ?? 0;
  const total = candidate.totalScore ?? Math.round(averageValues([memory, leadership, problemSolving, ethics, risk, network, strategy]));

  return {
    memory: clamp(memory),
    leadership: clamp(leadership),
    problemSolving: clamp(problemSolving),
    ethics: clamp(ethics),
    risk: clamp(risk),
    network: clamp(network),
    strategy: clamp(strategy),
    total: clamp(total),
  };
}

function averageValues(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectStrengths(scores: ScoreSnapshot) {
  const mapArr = [
    { name: 'Memoria', score: scores.memory },
    { name: 'Gestión de equipos', score: scores.leadership },
    { name: 'Resolución de crisis', score: scores.problemSolving },
    { name: 'Ética bajo presión', score: scores.ethics },
    { name: 'Gestión de riesgo', score: scores.risk },
    { name: 'Multitarea', score: scores.network },
    { name: 'Estrategia', score: scores.strategy },
  ];
  const sorted = [...mapArr].sort((a, b) => b.score - a.score);
  const strengths: string[] = [];

  for (const s of sorted) {
    if (s.score >= 70) strengths.push(`Alta solidez en ${s.name} (${s.score}/100).`);
    else if (s.score >= 55) strengths.push(`Base sólida en ${s.name} (${s.score}/100).`);
    else if (s.score >= 45 && strengths.length === 0) {
      strengths.push(`${s.name} es su área más alta (${s.score}/100).`);
    }
  }
  return strengths.slice(0, 3);
}

function collectRisks(scores: ScoreSnapshot) {
  const mapArr = [
    { name: 'Memoria', score: scores.memory, msg: 'Retención y reconstrucción de patrones débiles' },
    { name: 'Gestión de equipos', score: scores.leadership, msg: 'Criterio de asignación y distribución de carga bajo' },
    { name: 'Resolución de crisis', score: scores.problemSolving, msg: 'Respuesta en escenarios críticos a validar' },
    { name: 'Ética bajo presión', score: scores.ethics, msg: 'Criterio ético a profundizar en entrevista' },
    { name: 'Gestión de riesgo', score: scores.risk, msg: 'Control de riesgo a validar bajo incertidumbre' },
    { name: 'Multitarea', score: scores.network, msg: 'Atención dividida a reforzar con múltiples frentes' },
    { name: 'Estrategia', score: scores.strategy, msg: 'Priorización estratégica a validar' },
  ];
  const sorted = [...mapArr].sort((a, b) => a.score - b.score);
  const risks: string[] = [];
  
  for (const r of sorted) {
    if (r.score < 35) {
      risks.push(`[${r.name}] ${r.msg} (${r.score}/100).`);
    } else if (r.score < 50 && risks.length < 2) {
      risks.push(`[${r.name}] Área de desarrollo: ${r.msg.toLowerCase()} (${r.score}/100).`);
    }
  }
  if (risks.length === 0 && sorted[0].score < 60) {
    risks.push(`Punto a vigilar: ${sorted[0].name.toLowerCase()} (${sorted[0].score}/100).`);
  }
  return risks.slice(0, 3);
}


function buildPrompts(scores: ScoreSnapshot): InterviewPrompt[] {
  const prompts: InterviewPrompt[] = [];

  if (scores.problemSolving <= 65) {
    prompts.push({
      title: 'Claridad en crisis',
      question: 'Pídele que explique una situación compleja en tres pasos: contexto, acción y resultado.',
      signal: 'Esperamos orden, síntesis y mensajes accionables sin perder información clave.',
    });
  }

  if (scores.ethics <= 65) {
    prompts.push({
      title: 'Criterio ético',
      question: 'Pídele un ejemplo donde haya tenido que decidir entre seguir una regla y proteger a una persona.',
      signal: 'Buscamos consistencia ética y capacidad de fundamentar la decisión.',
    });
  }

  if (scores.strategy <= 65) {
    prompts.push({
      title: 'Visión estratégica',
      question: 'Pídele que priorice 3 iniciativas con recursos limitados y explique su criterio.',
      signal: 'Debe justificar decisiones con lógica y no solo con intuición.',
    });
  }

  if (scores.memory <= 65) {
    prompts.push({
      title: 'Retención y patrones',
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
    return 'final-review';
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
  const allScores = [scores.memory, scores.leadership, scores.problemSolving, scores.ethics, scores.risk, scores.network, scores.strategy];
  const criticalLows = allScores.filter((value) => value < 35).length;
  const lowSignals = allScores.filter((value) => value < 45).length;
  const strongSignals = allScores.filter((value) => value >= 70).length;
  const moderateSignals = allScores.filter((value) => value >= 55).length;

  let decision: RecruiterDecision = 'review';
  if (candidate.status === 'rejected') {
    decision = 'decline';
  } else if (candidate.status === 'hired' || candidate.status === 'shortlisted') {
    // Respect existing recruiter decisions
    decision = 'advance';
  } else if (scores.total >= 62 && criticalLows === 0) {
    // Solid profile: good overall and no critical failures
    decision = 'advance';
  } else if (scores.total >= 55 && strongSignals >= 2 && criticalLows === 0) {
    // Specialist profile: clear strengths that compensate moderate total
    decision = 'advance';
  } else if (scores.total < 30 || criticalLows >= 4) {
    // Only decline on genuinely weak profiles
    decision = 'decline';
  } else if (scores.total < 40 && lowSignals >= 4) {
    // Low total combined with many weak areas
    decision = 'decline';
  }
  // Everything else stays as 'review' — the largest and most useful bucket

  const readinessScore = scores.total;

  const rationale =
    decision === 'advance'
      ? `Avanzar. Perfil sólido: score total ${scores.total}/100${strongSignals > 0 ? `, con ${strongSignals} área${strongSignals > 1 ? 's' : ''} destacada${strongSignals > 1 ? 's' : ''}` : ''}. Listo para entrevista enfocada.`
      : decision === 'decline'
        ? `No avanzar. Score total ${scores.total}/100 con ${criticalLows} área${criticalLows !== 1 ? 's' : ''} crítica${criticalLows !== 1 ? 's' : ''} (<35). Requiere desarrollo antes de avanzar.`
        : `Revisar. Score total ${scores.total}/100. ${moderateSignals > 0 ? `Tiene ${moderateSignals} área${moderateSignals > 1 ? 's' : ''} con base sólida.` : 'Conviene'} validar en entrevista los puntos más bajos.`;

  const nextStep =
    decision === 'advance'
      ? 'Mover a shortlist y agendar validación final de encaje cultural.'
      : decision === 'decline'
        ? 'Mantener en reserva. Puede reconsiderarse si el rol tolera mayor curva de aprendizaje.'
        : 'Agendar entrevista estructurada para profundizar en las áreas más bajas.';

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
    if (Boolean(left.shortlistManual) && Boolean(right.shortlistManual)) {
      const leftOrder = left.shortlistOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.shortlistOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
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
