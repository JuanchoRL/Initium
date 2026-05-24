import type { GameMetrics, MetricsMap } from '@/lib/types';
import type {
  CandidateFitScores,
  CandidateResult,
  JobOpening,
  VacancyScoreProfileId,
} from '@/types/admin-dashboard';
import {
  type AssessmentScoreKey,
  getVacancyScoreProfile,
  resolveJobScoreProfile,
} from '@/lib/admin-dashboard/vacancy-scoring';

export type SkillGraphStatus = 'exceeds' | 'meets' | 'watch' | 'gap';
export type SkillEvidenceTone = 'positive' | 'neutral' | 'caution';

export type SkillGraphEvidence = {
  label: string;
  source: string;
  value: string;
  detail: string;
  tone: SkillEvidenceTone;
};

export type SkillGraphNode = {
  id: string;
  label: string;
  category: string;
  description: string;
  requiredLevel: number;
  observedLevel: number;
  gap: number;
  confidence: number;
  status: SkillGraphStatus;
  evidence: SkillGraphEvidence[];
  interviewPrompt: string;
};

export type SkillsGraph = {
  profileId: VacancyScoreProfileId;
  profileLabel: string;
  readiness: number;
  headline: string;
  strongestSkill: SkillGraphNode | null;
  largestGap: SkillGraphNode | null;
  nodes: SkillGraphNode[];
};

type CategoryScoreKey = 'technicalScore' | 'cognitiveScore' | 'softSkillsScore';

type SkillContext = {
  candidate: CandidateResult;
  metrics?: Partial<MetricsMap> | null;
};

type SkillDefinition = {
  id: string;
  label: string;
  category: string;
  description: string;
  baseRequirement: number;
  requirementOverrides?: Partial<Record<VacancyScoreProfileId, number>>;
  gameWeights: Partial<Record<AssessmentScoreKey, number>>;
  fitKey?: keyof CandidateFitScores;
  categoryKey?: CategoryScoreKey;
  interviewPrompt: string;
  metricEvidence?: (context: SkillContext) => SkillGraphEvidence[];
};

const GAME_LABELS: Record<AssessmentScoreKey, string> = {
  memory: 'Memoria visual',
  leadership: 'Gestión de recursos',
  problemSolving: 'Resolución de crisis',
  ethics: 'Auditoría ética',
  risk: 'Riesgo e incertidumbre',
  network: 'Red de enrutamiento',
  strategy: 'Matriz estratégica',
};

const GAME_SIGNAL_COPY: Record<AssessmentScoreKey, string> = {
  memory: 'retención de patrones, secuencia y precisión bajo tiempo',
  leadership: 'asignación de trabajo, balance de carga y criterio operativo',
  problemSolving: 'estructura de respuesta, empatía y claridad de ejecución',
  ethics: 'integridad, consistencia moral y presión jerárquica',
  risk: 'autocontrol, timing y lectura de incertidumbre',
  network: 'atención dividida, anticipación y velocidad de procesamiento',
  strategy: 'priorización, trade-offs y consistencia de foco',
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(items: Array<{ value: number; weight: number }>) {
  const validItems = items.filter((item) => Number.isFinite(item.value) && Number.isFinite(item.weight) && item.weight > 0);
  if (!validItems.length) return null;
  const weightedSum = validItems.reduce((sum, item) => sum + item.value * item.weight, 0);
  const totalWeight = validItems.reduce((sum, item) => sum + item.weight, 0);
  return totalWeight > 0 ? clamp(weightedSum / totalWeight) : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function metric(metrics: GameMetrics | undefined, keys: string[]) {
  for (const key of keys) {
    const value = toNumber(metrics?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function percent(value: number | null) {
  if (value === null) return null;
  return clamp(value <= 1 ? value * 100 : value);
}

function toneFromScore(value: number): SkillEvidenceTone {
  if (value >= 75) return 'positive';
  if (value >= 55) return 'neutral';
  return 'caution';
}

function evidence(label: string, source: string, value: string, detail: string, tone: SkillEvidenceTone): SkillGraphEvidence {
  return { label, source, value, detail, tone };
}

function getCategoryScore(candidate: CandidateResult, key?: CategoryScoreKey) {
  if (!key) return null;
  return toNumber(candidate[key]);
}

function buildMetricEvidence(context: SkillContext, skillId: string): SkillGraphEvidence[] {
  const metrics = context.metrics;
  if (!metrics) return [];

  if (skillId === 'technical-coordination') {
    const roleMatch = percent(metric(metrics.leadership, ['role_match_rate']));
    const recovery = percent(metric(metrics.leadership, ['recovery_index']));
    const overloads = metric(metrics.leadership, ['overload_warnings']);
    return [
      roleMatch === null
        ? null
        : evidence('Match de rol', 'Gestión de recursos', `${roleMatch}%`, 'Mide si asignó tareas al perfil correcto.', toneFromScore(roleMatch)),
      recovery === null
        ? null
        : evidence('Recuperación operativa', 'Gestión de recursos', `${recovery}%`, 'Refleja capacidad de corregir presión y carga.', toneFromScore(recovery)),
      overloads === null
        ? null
        : evidence('Alertas de sobrecarga', 'Gestión de recursos', String(overloads), 'Menos alertas sugieren mejor coordinación del equipo.', overloads <= 1 ? 'positive' : overloads <= 3 ? 'neutral' : 'caution'),
    ].filter(Boolean) as SkillGraphEvidence[];
  }

  if (skillId === 'analytical-reasoning') {
    const memoryRounds = metric(metrics.memory, ['correct_patterns', 'correct_pairs']);
    const avgTime = metric(metrics.memory, ['avg_reconstruction_time_sec', 'avg_pair_time_seconds']);
    const diversity = percent(metric(metrics.strategy, ['diversity_index']));
    return [
      memoryRounds === null
        ? null
        : evidence('Patrones correctos', 'Memoria visual', String(memoryRounds), 'Evalúa reconstrucción de información con precisión.', memoryRounds >= 3 ? 'positive' : 'neutral'),
      avgTime === null
        ? null
        : evidence('Tiempo medio', 'Memoria visual', `${avgTime.toFixed(1)}s`, 'Velocidad de análisis y ejecución en tareas visuales.', avgTime <= 12 ? 'positive' : avgTime <= 20 ? 'neutral' : 'caution'),
      diversity === null
        ? null
        : evidence('Diversidad estratégica', 'Matriz estratégica', `${diversity}%`, 'Indica amplitud de análisis antes de cerrar decisión.', toneFromScore(diversity)),
    ].filter(Boolean) as SkillGraphEvidence[];
  }

  if (skillId === 'crisis-communication' || skillId === 'executive-communication') {
    const empathy = percent(metric(metrics.problemSolving, ['empathy']));
    const structure = percent(metric(metrics.problemSolving, ['structure']));
    const decisiveness = percent(metric(metrics.problemSolving, ['decisiveness']));
    return [
      structure === null
        ? null
        : evidence('Estructura', 'Resolución de crisis', `${structure}%`, 'Ordena contexto, acción y seguimiento.', toneFromScore(structure)),
      empathy === null
        ? null
        : evidence('Empatía', 'Resolución de crisis', `${empathy}%`, 'Detecta impacto humano y cuida el vínculo.', toneFromScore(empathy)),
      decisiveness === null
        ? null
        : evidence('Decisión', 'Resolución de crisis', `${decisiveness}%`, 'Convierte análisis en próximos pasos claros.', toneFromScore(decisiveness)),
    ].filter(Boolean) as SkillGraphEvidence[];
  }

  if (skillId === 'ethical-judgement' || skillId === 'culture-alignment') {
    const integrity = percent(metric(metrics.ethics, ['ethical_integrity']));
    const consistency = percent(metric(metrics.ethics, ['decision_consistency']));
    const pressure = percent(metric(metrics.ethics, ['pressure_control']));
    return [
      integrity === null
        ? null
        : evidence('Integridad', 'Auditoría ética', `${integrity}%`, 'Mide criterio moral ante dilemas con presión.', toneFromScore(integrity)),
      consistency === null
        ? null
        : evidence('Consistencia', 'Auditoría ética', `${consistency}%`, 'Evalúa estabilidad del criterio entre casos.', toneFromScore(consistency)),
      pressure === null
        ? null
        : evidence('Presión', 'Auditoría ética', `${pressure}%`, 'Refleja control ante autoridad o urgencia.', toneFromScore(pressure)),
    ].filter(Boolean) as SkillGraphEvidence[];
  }

  if (skillId === 'risk-control') {
    const releaseRatio = percent(metric(metrics.risk, ['release_ratio']));
    const tolerance = percent(metric(metrics.risk, ['risk_tolerance']));
    const explosions = metric(metrics.risk, ['explosions']);
    return [
      releaseRatio === null
        ? null
        : evidence('Timing de liberación', 'Riesgo e incertidumbre', `${releaseRatio}%`, 'Captura cuándo decide asegurar valor.', toneFromScore(releaseRatio)),
      tolerance === null
        ? null
        : evidence('Tolerancia al riesgo', 'Riesgo e incertidumbre', `${tolerance}%`, 'Ubica apetito de riesgo relativo.', tolerance >= 35 && tolerance <= 75 ? 'positive' : 'neutral'),
      explosions === null
        ? null
        : evidence('Pérdidas máximas', 'Riesgo e incertidumbre', String(explosions), 'Menos pérdidas extremas elevan la señal de autocontrol.', explosions <= 2 ? 'positive' : explosions <= 4 ? 'neutral' : 'caution'),
    ].filter(Boolean) as SkillGraphEvidence[];
  }

  if (skillId === 'multitasking-execution') {
    const accuracy = percent(metric(metrics.network, ['accuracy_pct', 'accuracy']));
    const correct = metric(metrics.network, ['correct_connections', 'correct_routes']);
    const flips = metric(metrics.network, ['switch_flips']);
    return [
      accuracy === null
        ? null
        : evidence('Precisión multitarea', 'Red de enrutamiento', `${accuracy}%`, 'Mide acierto bajo múltiples frentes simultáneos.', toneFromScore(accuracy)),
      correct === null
        ? null
        : evidence('Rutas correctas', 'Red de enrutamiento', String(correct), 'Cantidad de decisiones operativas exitosas.', correct >= 12 ? 'positive' : 'neutral'),
      flips === null
        ? null
        : evidence('Cambios de switch', 'Red de enrutamiento', String(flips), 'Actividad táctica durante el flujo de presión.', flips >= 4 ? 'positive' : 'neutral'),
    ].filter(Boolean) as SkillGraphEvidence[];
  }

  if (skillId === 'strategic-prioritization') {
    const diversity = percent(metric(metrics.strategy, ['diversity_index']));
    const adjustments = metric(metrics.strategy, ['adjustments']);
    return [
      diversity === null
        ? null
        : evidence('Diversidad de foco', 'Matriz estratégica', `${diversity}%`, 'Balance entre opciones antes de invertir recursos.', toneFromScore(diversity)),
      adjustments === null
        ? null
        : evidence('Ajustes', 'Matriz estratégica', String(adjustments), 'Cantidad de iteraciones antes de cerrar una estrategia.', adjustments <= 14 ? 'positive' : 'caution'),
    ].filter(Boolean) as SkillGraphEvidence[];
  }

  return [];
}

const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    id: 'technical-coordination',
    label: 'Coordinación técnica',
    category: 'Ejecución',
    description: 'Asigna trabajo con criterio de rol, carga y complejidad.',
    baseRequirement: 68,
    requirementOverrides: { engineering: 84, operations: 80, product: 74, data: 72, people: 72 },
    gameWeights: { leadership: 0.5, network: 0.3, strategy: 0.2 },
    fitKey: 'technicalMatch',
    categoryKey: 'technicalScore',
    interviewPrompt: 'Pídele que reparta tres tareas críticas entre perfiles con capacidades distintas y explique el criterio.',
    metricEvidence: (context) => buildMetricEvidence(context, 'technical-coordination'),
  },
  {
    id: 'analytical-reasoning',
    label: 'Razonamiento analítico',
    category: 'Cognitivo',
    description: 'Reconstruye patrones, separa ruido y sostiene decisiones con datos.',
    baseRequirement: 70,
    requirementOverrides: { data: 86, engineering: 78, operations: 76, product: 74 },
    gameWeights: { memory: 0.35, network: 0.25, risk: 0.2, strategy: 0.2 },
    fitKey: 'cognitivePerformance',
    categoryKey: 'cognitiveScore',
    interviewPrompt: 'Dale un mini caso con datos incompletos y pídele que separe hechos, hipótesis y decisión.',
    metricEvidence: (context) => buildMetricEvidence(context, 'analytical-reasoning'),
  },
  {
    id: 'crisis-communication',
    label: 'Resolución de crisis',
    category: 'Comunicación',
    description: 'Ordena presión, personas afectadas y próximos pasos accionables.',
    baseRequirement: 70,
    requirementOverrides: { customer: 84, sales: 80, product: 80, people: 78 },
    gameWeights: { problemSolving: 0.55, ethics: 0.25, leadership: 0.2 },
    fitKey: 'communication',
    categoryKey: 'softSkillsScore',
    interviewPrompt: 'Pídele que cuente una crisis real en tres capas: impacto, decisión y seguimiento.',
    metricEvidence: (context) => buildMetricEvidence(context, 'crisis-communication'),
  },
  {
    id: 'ethical-judgement',
    label: 'Criterio ético',
    category: 'Confianza',
    description: 'Sostiene estándares claros cuando hay presión, ambigüedad o incentivos cruzados.',
    baseRequirement: 74,
    requirementOverrides: { people: 88, customer: 84, product: 80, data: 78, operations: 78 },
    gameWeights: { ethics: 0.65, problemSolving: 0.2, strategy: 0.15 },
    fitKey: 'cultureFit',
    categoryKey: 'softSkillsScore',
    interviewPrompt: 'Explora una decisión donde haya tenido que elegir entre velocidad, regla y cuidado de una persona.',
    metricEvidence: (context) => buildMetricEvidence(context, 'ethical-judgement'),
  },
  {
    id: 'risk-control',
    label: 'Control de riesgo',
    category: 'Decisión',
    description: 'Toma riesgo con disciplina y evita pérdidas por impulso o demora.',
    baseRequirement: 66,
    requirementOverrides: { operations: 82, data: 78, engineering: 74, sales: 72 },
    gameWeights: { risk: 0.55, strategy: 0.25, network: 0.2 },
    fitKey: 'cognitivePerformance',
    categoryKey: 'cognitiveScore',
    interviewPrompt: 'Pídele un ejemplo de una decisión con información incompleta y cómo definió el umbral de riesgo.',
    metricEvidence: (context) => buildMetricEvidence(context, 'risk-control'),
  },
  {
    id: 'multitasking-execution',
    label: 'Ejecución multitarea',
    category: 'Operación',
    description: 'Mantiene precisión cuando varios frentes compiten por atención.',
    baseRequirement: 68,
    requirementOverrides: { operations: 84, engineering: 82, data: 78, customer: 74 },
    gameWeights: { network: 0.6, memory: 0.2, leadership: 0.2 },
    fitKey: 'technicalMatch',
    categoryKey: 'technicalScore',
    interviewPrompt: 'Pídele que explique cómo prioriza cuando dos urgencias reales ocurren al mismo tiempo.',
    metricEvidence: (context) => buildMetricEvidence(context, 'multitasking-execution'),
  },
  {
    id: 'strategic-prioritization',
    label: 'Priorización estratégica',
    category: 'Estrategia',
    description: 'Decide trade-offs, foco y secuencia de inversión con recursos limitados.',
    baseRequirement: 70,
    requirementOverrides: { product: 88, sales: 80, operations: 80, engineering: 78, data: 76 },
    gameWeights: { strategy: 0.6, risk: 0.2, problemSolving: 0.2 },
    fitKey: 'leadershipPotential',
    categoryKey: 'softSkillsScore',
    interviewPrompt: 'Dale cinco iniciativas y recursos limitados; debe elegir tres y defender el trade-off.',
    metricEvidence: (context) => buildMetricEvidence(context, 'strategic-prioritization'),
  },
  {
    id: 'executive-communication',
    label: 'Comunicación ejecutiva',
    category: 'Influencia',
    description: 'Sintetiza, persuade y convierte análisis en mensajes claros.',
    baseRequirement: 68,
    requirementOverrides: { sales: 84, customer: 84, people: 82, product: 80 },
    gameWeights: { problemSolving: 0.5, leadership: 0.25, ethics: 0.25 },
    fitKey: 'communication',
    categoryKey: 'softSkillsScore',
    interviewPrompt: 'Pídele que explique una decisión difícil a un stakeholder no técnico en menos de dos minutos.',
    metricEvidence: (context) => buildMetricEvidence(context, 'executive-communication'),
  },
  {
    id: 'leadership-potential',
    label: 'Potencial de liderazgo',
    category: 'Liderazgo',
    description: 'Balancea personas, presión, responsabilidad y criterio de avance.',
    baseRequirement: 68,
    requirementOverrides: { people: 84, sales: 82, product: 80, operations: 78, customer: 76 },
    gameWeights: { leadership: 0.55, strategy: 0.25, ethics: 0.2 },
    fitKey: 'leadershipPotential',
    categoryKey: 'softSkillsScore',
    interviewPrompt: 'Pregúntale cómo subiría el rendimiento de un equipo cansado sin deteriorar calidad ni vínculo.',
    metricEvidence: (context) => buildMetricEvidence(context, 'technical-coordination'),
  },
  {
    id: 'culture-alignment',
    label: 'Alineación cultural',
    category: 'Cultura',
    description: 'Muestra colaboración, consistencia de valores y sensibilidad humana.',
    baseRequirement: 68,
    requirementOverrides: { people: 86, customer: 82, sales: 76, product: 76 },
    gameWeights: { ethics: 0.4, problemSolving: 0.35, leadership: 0.25 },
    fitKey: 'cultureFit',
    categoryKey: 'softSkillsScore',
    interviewPrompt: 'Explora qué comportamientos considera no negociables dentro de un equipo de alto ritmo.',
    metricEvidence: (context) => buildMetricEvidence(context, 'culture-alignment'),
  },
];

function calculateRequiredLevel(definition: SkillDefinition, profileId: VacancyScoreProfileId) {
  const profile = getVacancyScoreProfile(profileId);
  const override = definition.requirementOverrides?.[profileId];
  if (typeof override === 'number') return clamp(override);

  const gameImportance = average(
    Object.keys(definition.gameWeights).map((key) => profile.scoreWeights[key as AssessmentScoreKey] ?? 1)
  );
  const categoryImportance = definition.categoryKey ? profile.categoryWeights[definition.categoryKey] ?? 0.33 : 0.33;
  return clamp(definition.baseRequirement + (gameImportance - 1) * 24 + (categoryImportance - 0.33) * 38);
}

function calculateObservedLevel(definition: SkillDefinition, candidate: CandidateResult) {
  const rawScores = candidate.rawScores ?? {};
  const gameItems = Object.entries(definition.gameWeights).flatMap(([key, weight]) => {
    const score = toNumber(rawScores[key]);
    return score === null ? [] : [{ value: score, weight }];
  });
  const gameScore = weightedAverage(gameItems);
  const fitScore = definition.fitKey && candidate.fitScores ? toNumber(candidate.fitScores[definition.fitKey]) : null;
  const categoryScore = getCategoryScore(candidate, definition.categoryKey);

  const items = [
    gameScore === null ? null : { value: gameScore, weight: 0.62 },
    fitScore === null ? null : { value: fitScore, weight: 0.25 },
    categoryScore === null ? null : { value: categoryScore, weight: 0.13 },
  ].filter(Boolean) as Array<{ value: number; weight: number }>;

  return weightedAverage(items) ?? 0;
}

function calculateConfidence(definition: SkillDefinition, candidate: CandidateResult, metricEvidence: SkillGraphEvidence[]) {
  const rawScores = candidate.rawScores ?? {};
  const expectedGames = Object.keys(definition.gameWeights).length;
  const availableGames = Object.keys(definition.gameWeights).filter((key) => toNumber(rawScores[key]) !== null).length;
  const gameCoverage = expectedGames > 0 ? availableGames / expectedGames : 0;
  const fitCoverage = definition.fitKey && candidate.fitScores?.[definition.fitKey] != null ? 1 : 0;
  const categoryCoverage = definition.categoryKey && candidate[definition.categoryKey] != null ? 1 : 0;
  const metricDepth = Math.min(metricEvidence.length, 3) / 3;
  return clamp(gameCoverage * 50 + fitCoverage * 18 + categoryCoverage * 12 + metricDepth * 20);
}

function resolveStatus(gap: number): SkillGraphStatus {
  if (gap >= 8) return 'exceeds';
  if (gap >= -4) return 'meets';
  if (gap >= -14) return 'watch';
  return 'gap';
}

function buildGameEvidence(definition: SkillDefinition, candidate: CandidateResult) {
  const rawScores = candidate.rawScores ?? {};
  return Object.entries(definition.gameWeights)
    .map(([gameKey, weight]) => {
      const key = gameKey as AssessmentScoreKey;
      const score = toNumber(rawScores[key]);
      if (score === null) return null;
      return {
        item: evidence(
          GAME_LABELS[key],
          'Assessment',
          `${clamp(score)}/100`,
          GAME_SIGNAL_COPY[key],
          toneFromScore(score)
        ),
        weight,
        score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.weight - a!.weight) || (b!.score - a!.score))
    .slice(0, 2)
    .map((entry) => entry!.item);
}

function buildFitEvidence(definition: SkillDefinition, candidate: CandidateResult) {
  if (!definition.fitKey || !candidate.fitScores) return [];
  const score = toNumber(candidate.fitScores[definition.fitKey]);
  if (score === null) return [];
  return [
    evidence(
      'Fit derivado',
      'Modelo de score',
      `${clamp(score)}/100`,
      'Combina señales ponderadas para esta competencia.',
      toneFromScore(score)
    ),
  ];
}

function buildNode(definition: SkillDefinition, context: SkillContext, profileId: VacancyScoreProfileId): SkillGraphNode {
  const requiredLevel = calculateRequiredLevel(definition, profileId);
  const observedLevel = calculateObservedLevel(definition, context.candidate);
  const metricEvidence = definition.metricEvidence?.(context) ?? [];
  const evidenceItems = [
    ...buildGameEvidence(definition, context.candidate),
    ...metricEvidence,
    ...buildFitEvidence(definition, context.candidate),
  ].slice(0, 4);
  const confidence = calculateConfidence(definition, context.candidate, metricEvidence);
  const gap = Math.round(observedLevel - requiredLevel);

  return {
    id: definition.id,
    label: definition.label,
    category: definition.category,
    description: definition.description,
    requiredLevel,
    observedLevel,
    gap,
    confidence,
    status: resolveStatus(observedLevel - requiredLevel),
    evidence: evidenceItems,
    interviewPrompt: definition.interviewPrompt,
  };
}

function buildHeadline(nodes: SkillGraphNode[], profileLabel: string) {
  const gapCount = nodes.filter((node) => node.status === 'gap').length;
  const readyCount = nodes.filter((node) => node.status === 'exceeds' || node.status === 'meets').length;
  const largestGap = [...nodes].sort((a, b) => a.gap - b.gap)[0];
  const strongest = [...nodes].sort((a, b) => b.gap - a.gap)[0];

  if (readyCount >= 4 && gapCount === 0) {
    return `Encaje fuerte para ${profileLabel}: la evidencia cubre las skills críticas y deja pocas brechas abiertas.`;
  }
  if (gapCount >= 2 && largestGap) {
    return `Encaje a validar para ${profileLabel}: la mayor brecha aparece en ${largestGap.label.toLowerCase()}.`;
  }
  if (strongest) {
    return `Perfil competitivo para ${profileLabel}, con ventaja observable en ${strongest.label.toLowerCase()} y validaciones puntuales.`;
  }
  return `Lectura inicial para ${profileLabel}: faltan resultados suficientes para completar el graph.`;
}

export function buildCandidateSkillsGraph(input: {
  candidate: CandidateResult;
  job?: Pick<JobOpening, 'title' | 'department' | 'scoreProfileId'> | null;
  metrics?: Partial<MetricsMap> | null;
}): SkillsGraph {
  const profileId = input.candidate.scoreProfileId ?? resolveJobScoreProfile(input.job);
  const profile = getVacancyScoreProfile(profileId);
  const context: SkillContext = {
    candidate: input.candidate,
    metrics: input.metrics,
  };
  const nodes = SKILL_DEFINITIONS.map((definition) => buildNode(definition, context, profile.id))
    .sort((a, b) => (b.requiredLevel - a.requiredLevel) || (a.gap - b.gap))
    .slice(0, 6);

  const strongestSkill = nodes.length ? [...nodes].sort((a, b) => b.gap - a.gap)[0] : null;
  const largestGap = nodes.length ? [...nodes].sort((a, b) => a.gap - b.gap)[0] : null;
  const readiness = nodes.length
    ? clamp(
        average(nodes.map((node) => node.observedLevel)) * 0.58 +
          average(nodes.map((node) => node.confidence)) * 0.18 +
          average(nodes.map((node) => Math.max(0, 100 - Math.max(0, node.requiredLevel - node.observedLevel)))) * 0.24
      )
    : 0;

  return {
    profileId: profile.id,
    profileLabel: profile.label,
    readiness,
    headline: buildHeadline(nodes, profile.label),
    strongestSkill,
    largestGap,
    nodes,
  };
}
