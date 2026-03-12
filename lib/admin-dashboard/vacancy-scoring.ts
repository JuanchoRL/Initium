import type {
  CandidateFitScores,
  JobOpening,
  VacancyScoreProfile,
  VacancyScoreProfileId,
} from '@/types/admin-dashboard';

export const ASSESSMENT_SCORE_KEYS = [
  'memory',
  'leadership',
  'problemSolving',
  'risk',
  'network',
  'strategy',
] as const;

export type AssessmentScoreKey = (typeof ASSESSMENT_SCORE_KEYS)[number];
type SummaryCategoryKey = 'technicalScore' | 'cognitiveScore' | 'softSkillsScore';

export type AssessmentSummary = {
  totalScore: number;
  technicalScore: number;
  cognitiveScore: number;
  softSkillsScore: number;
  fitScores: CandidateFitScores;
  scoreProfileId: VacancyScoreProfileId;
  scoreProfileLabel: string;
};

export type PartialAssessmentSummary = {
  totalScore: number | null;
  technicalScore: number | null;
  cognitiveScore: number | null;
  softSkillsScore: number | null;
  fitScores: CandidateFitScores | null;
  scoreProfileId: VacancyScoreProfileId;
  scoreProfileLabel: string;
};

const CATEGORY_SCORE_MAP: Record<SummaryCategoryKey, AssessmentScoreKey[]> = {
  technicalScore: ['leadership', 'network', 'strategy'],
  cognitiveScore: ['memory', 'risk', 'network'],
  softSkillsScore: ['problemSolving', 'leadership', 'strategy'],
};

const FIT_SCORE_MAP: Record<keyof CandidateFitScores, AssessmentScoreKey[]> = {
  technicalMatch: ['leadership', 'network', 'strategy'],
  cognitivePerformance: ['memory', 'risk', 'network'],
  behavioralFit: ['problemSolving', 'leadership', 'strategy'],
  communication: ['problemSolving', 'leadership'],
  leadershipPotential: ['leadership', 'strategy'],
  cultureFit: ['problemSolving', 'leadership', 'strategy'],
};

export const VACANCY_SCORE_PROFILES: Record<VacancyScoreProfileId, VacancyScoreProfile> = {
  generalist: {
    id: 'generalist',
    label: 'Generalista',
    description: 'Balance estándar para roles donde se espera un rendimiento parejo en todas las áreas.',
    scoreWeights: {
      memory: 1,
      leadership: 1,
      problemSolving: 1,
      risk: 1,
      network: 1,
      strategy: 1,
    },
    categoryWeights: {
      technicalScore: 0.34,
      cognitiveScore: 0.33,
      softSkillsScore: 0.33,
    },
  },
  engineering: {
    id: 'engineering',
    label: 'Ingeniería',
    description: 'Prioriza estructura, coordinación técnica y consistencia en la toma de decisiones.',
    scoreWeights: {
      memory: 1.05,
      leadership: 0.8,
      problemSolving: 1.05,
      risk: 0.95,
      network: 1.3,
      strategy: 1.15,
    },
    categoryWeights: {
      technicalScore: 0.45,
      cognitiveScore: 0.35,
      softSkillsScore: 0.2,
    },
  },
  data: {
    id: 'data',
    label: 'Datos y análisis',
    description: 'Favorece perfiles metódicos, analíticos y con alta precisión bajo presión.',
    scoreWeights: {
      memory: 1.2,
      leadership: 0.7,
      problemSolving: 1,
      risk: 1.1,
      network: 1.2,
      strategy: 1,
    },
    categoryWeights: {
      technicalScore: 0.3,
      cognitiveScore: 0.5,
      softSkillsScore: 0.2,
    },
  },
  product: {
    id: 'product',
    label: 'Producto',
    description: 'Da más peso a criterio, visión, coordinación entre áreas y claridad en escenarios ambiguos.',
    scoreWeights: {
      memory: 0.95,
      leadership: 1.05,
      problemSolving: 1.15,
      risk: 0.85,
      network: 1,
      strategy: 1.35,
    },
    categoryWeights: {
      technicalScore: 0.3,
      cognitiveScore: 0.3,
      softSkillsScore: 0.4,
    },
  },
  customer: {
    id: 'customer',
    label: 'Customer / soporte',
    description: 'Premia empatía, contención, comunicación y resolución práctica de situaciones tensas.',
    scoreWeights: {
      memory: 0.8,
      leadership: 1.05,
      problemSolving: 1.3,
      risk: 0.8,
      network: 0.9,
      strategy: 0.95,
    },
    categoryWeights: {
      technicalScore: 0.2,
      cognitiveScore: 0.25,
      softSkillsScore: 0.55,
    },
  },
  sales: {
    id: 'sales',
    label: 'Ventas / comercial',
    description: 'Valora iniciativa, comunicación, lectura del contexto y reacción en entornos cambiantes.',
    scoreWeights: {
      memory: 0.75,
      leadership: 1.2,
      problemSolving: 1.2,
      risk: 1,
      network: 0.8,
      strategy: 1.1,
    },
    categoryWeights: {
      technicalScore: 0.25,
      cognitiveScore: 0.2,
      softSkillsScore: 0.55,
    },
  },
  people: {
    id: 'people',
    label: 'People / RR. HH.',
    description: 'Sube el valor de empatía, gestión interpersonal y decisiones cuidadosas con personas.',
    scoreWeights: {
      memory: 0.75,
      leadership: 1.2,
      problemSolving: 1.2,
      risk: 0.8,
      network: 0.9,
      strategy: 1,
    },
    categoryWeights: {
      technicalScore: 0.15,
      cognitiveScore: 0.25,
      softSkillsScore: 0.6,
    },
  },
  operations: {
    id: 'operations',
    label: 'Operaciones',
    description: 'Busca ejecución estable, lectura del riesgo y buena coordinación entre frentes activos.',
    scoreWeights: {
      memory: 1,
      leadership: 0.95,
      problemSolving: 1,
      risk: 1.15,
      network: 1.05,
      strategy: 1.1,
    },
    categoryWeights: {
      technicalScore: 0.35,
      cognitiveScore: 0.35,
      softSkillsScore: 0.3,
    },
  },
};

export const VACANCY_SCORE_PROFILE_OPTIONS = Object.values(VACANCY_SCORE_PROFILES);

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values: Array<number | null | undefined>) {
  const numeric = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!numeric.length) return null;
  return average(numeric);
}

function toScore(value: number | undefined) {
  return Number.isFinite(value) ? clampScore(value as number) : 0;
}

function weightedAverageScores(
  scores: Partial<Record<AssessmentScoreKey, number>>,
  keys: AssessmentScoreKey[],
  weightMap: Record<AssessmentScoreKey, number>
) {
  let weightedSum = 0;
  let totalWeight = 0;

  keys.forEach((key) => {
    const value = toScore(scores[key]);
    const weight = weightMap[key] ?? 1;
    weightedSum += value * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) return 0;
  return clampScore(weightedSum / totalWeight);
}

export function getVacancyScoreProfile(profileId?: VacancyScoreProfileId | null) {
  return VACANCY_SCORE_PROFILES[profileId ?? 'generalist'] ?? VACANCY_SCORE_PROFILES.generalist;
}

export function inferVacancyScoreProfile(input: { title?: string | null; department?: string | null }): VacancyScoreProfileId {
  const normalized = `${input.title ?? ''} ${input.department ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

  if (/(backend|frontend|fullstack|software|devops|ingenier|platform|mobile|qa)/.test(normalized)) return 'engineering';
  if (/(data|analytics|analyst|bi|science|research|financ|fp&a)/.test(normalized)) return 'data';
  if (/(product|producto|ux|ui|design|diseno|growth product)/.test(normalized)) return 'product';
  if (/(customer|support|soporte|success|cx|csm)/.test(normalized)) return 'customer';
  if (/(sales|venta|comercial|account executive|business development|bdr|sdr)/.test(normalized)) return 'sales';
  if (/(people|rrhh|human resources|talent|recruit|reclut|hrbp)/.test(normalized)) return 'people';
  if (/(operations|ops|operaciones|logistic|legal|finance|finanzas|procurement)/.test(normalized)) return 'operations';
  return 'generalist';
}

export function buildAssessmentSummary(
  scores: Record<string, number>,
  profileId: VacancyScoreProfileId = 'generalist'
): AssessmentSummary {
  const profile = getVacancyScoreProfile(profileId);
  const weightedScores = scores as Partial<Record<AssessmentScoreKey, number>>;

  const technicalScore = weightedAverageScores(weightedScores, CATEGORY_SCORE_MAP.technicalScore, profile.scoreWeights);
  const cognitiveScore = weightedAverageScores(weightedScores, CATEGORY_SCORE_MAP.cognitiveScore, profile.scoreWeights);
  const softSkillsScore = weightedAverageScores(weightedScores, CATEGORY_SCORE_MAP.softSkillsScore, profile.scoreWeights);

  const totalScore = clampScore(
    technicalScore * profile.categoryWeights.technicalScore +
      cognitiveScore * profile.categoryWeights.cognitiveScore +
      softSkillsScore * profile.categoryWeights.softSkillsScore
  );

  const fitScores: CandidateFitScores = {
    technicalMatch: weightedAverageScores(weightedScores, FIT_SCORE_MAP.technicalMatch, profile.scoreWeights),
    cognitivePerformance: weightedAverageScores(weightedScores, FIT_SCORE_MAP.cognitivePerformance, profile.scoreWeights),
    behavioralFit: weightedAverageScores(weightedScores, FIT_SCORE_MAP.behavioralFit, profile.scoreWeights),
    communication: weightedAverageScores(weightedScores, FIT_SCORE_MAP.communication, profile.scoreWeights),
    leadershipPotential: weightedAverageScores(weightedScores, FIT_SCORE_MAP.leadershipPotential, profile.scoreWeights),
    cultureFit: weightedAverageScores(weightedScores, FIT_SCORE_MAP.cultureFit, profile.scoreWeights),
  };

  return {
    totalScore,
    technicalScore,
    cognitiveScore,
    softSkillsScore,
    fitScores,
    scoreProfileId: profile.id,
    scoreProfileLabel: profile.label,
  };
}

export function buildAssessmentSummaryFromCategories(
  scores: {
    technicalScore: number | null;
    cognitiveScore: number | null;
    softSkillsScore: number | null;
  },
  profileId: VacancyScoreProfileId = 'generalist'
): PartialAssessmentSummary {
  const profile = getVacancyScoreProfile(profileId);
  const technicalScore = scores.technicalScore;
  const cognitiveScore = scores.cognitiveScore;
  const softSkillsScore = scores.softSkillsScore;
  const totalScore = averageNullable([
    technicalScore == null ? null : technicalScore * profile.categoryWeights.technicalScore * 3,
    cognitiveScore == null ? null : cognitiveScore * profile.categoryWeights.cognitiveScore * 3,
    softSkillsScore == null ? null : softSkillsScore * profile.categoryWeights.softSkillsScore * 3,
  ]);

  const overall = averageNullable([technicalScore, cognitiveScore, softSkillsScore, totalScore]);
  if (overall == null) {
    return {
      totalScore: null,
      technicalScore,
      cognitiveScore,
      softSkillsScore,
      fitScores: null,
      scoreProfileId: profile.id,
      scoreProfileLabel: profile.label,
    };
  }

  const fitScores: CandidateFitScores = {
    technicalMatch: clampScore(average([technicalScore ?? overall, totalScore ?? overall])),
    cognitivePerformance: clampScore(average([cognitiveScore ?? overall, totalScore ?? overall])),
    behavioralFit: clampScore(average([softSkillsScore ?? overall, totalScore ?? overall])),
    communication: clampScore(average([softSkillsScore ?? overall, cognitiveScore ?? overall])),
    leadershipPotential: clampScore(average([technicalScore ?? overall, softSkillsScore ?? overall, totalScore ?? overall])),
    cultureFit: clampScore(average([softSkillsScore ?? overall, overall])),
  };

  return {
    totalScore: clampScore(totalScore ?? overall),
    technicalScore,
    cognitiveScore,
    softSkillsScore,
    fitScores,
    scoreProfileId: profile.id,
    scoreProfileLabel: profile.label,
  };
}

export function getVacancyScoreProfileLabel(profileId?: VacancyScoreProfileId | null) {
  return getVacancyScoreProfile(profileId).label;
}

export function resolveJobScoreProfile(job?: Pick<JobOpening, 'scoreProfileId' | 'title' | 'department'> | null) {
  if (!job) return 'generalist' as VacancyScoreProfileId;
  return job.scoreProfileId ?? inferVacancyScoreProfile(job);
}
