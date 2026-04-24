export type PersonalityTraitId = 'D' | 'I' | 'S' | 'C';

export const personalityTraitMeta: Record<PersonalityTraitId, { label: string; name: string }> = {
  D: { label: 'Impulsor Estratégico', name: 'Dominante' },
  I: { label: 'Conector Social', name: 'Influyente' },
  S: { label: 'Soporte Estable', name: 'Estable' },
  C: { label: 'Analista Crítico', name: 'Concienzudo' },
};

export const personalityBlendLabels: Partial<Record<`${PersonalityTraitId}-${PersonalityTraitId}`, string>> = {
  'D-I': 'Líder Visionario',
  'D-C': 'Estratega Ejecutivo',
  'D-S': 'Impulsor de Equipos',
  'I-D': 'Catalizador Social',
  'I-S': 'Conector Empático',
  'I-C': 'Comunicador Persuasivo',
  'S-I': 'Facilitador Colaborativo',
  'S-C': 'Soporte Confiable',
  'S-D': 'Coordinador Sereno',
  'C-D': 'Analista Estratégico',
  'C-S': 'Especialista Metódico',
  'C-I': 'Curador de Calidad',
};

export const normalizePersonalityTrait = (value: unknown): PersonalityTraitId | null => {
  if (value === 'D' || value === 'I' || value === 'S' || value === 'C') return value;
  return null;
};

const toSafeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const derivePersonalityProfileLabel = (
  dominant: PersonalityTraitId | null,
  secondary?: PersonalityTraitId | null
) => {
  if (!dominant) return '';
  if (secondary && secondary !== dominant) {
    const blended = personalityBlendLabels[`${dominant}-${secondary}`];
    if (blended) return blended;
  }
  return personalityTraitMeta[dominant].label;
};

export const derivePersonalitySubtypeLabel = (
  dominant: PersonalityTraitId | null,
  secondary?: PersonalityTraitId | null
) => {
  if (!dominant) return '';
  if (secondary && secondary !== dominant) {
    return `Base: ${personalityTraitMeta[dominant].name} + ${personalityTraitMeta[secondary].name}`;
  }
  return `Base: ${personalityTraitMeta[dominant].name}`;
};

// Anti-bias tiebreak order: S > C > I > D (inverse of social desirability)
const TIEBREAK_ORDER: Record<PersonalityTraitId, number> = { S: 0, C: 1, I: 2, D: 3 };

const sortTraitEntries = (entries: Array<[PersonalityTraitId, number]>) => {
  return [...entries].sort((a, b) => b[1] - a[1] || TIEBREAK_ORDER[a[0]] - TIEBREAK_ORDER[b[0]]);
};

export const resolvePersonalitySummary = (
  personalityMetrics?: Record<string, unknown>,
  fallbackProfile = ''
) => {
  if (!personalityMetrics) {
    return {
      profile: fallbackProfile,
      subtype: '',
      dominant: null as PersonalityTraitId | null,
      secondary: null as PersonalityTraitId | null,
    };
  }

  let dominant = normalizePersonalityTrait(personalityMetrics.dominant_profile);
  let secondary = normalizePersonalityTrait(personalityMetrics.secondary_profile);

  if (!dominant) {
    const entries = [
      ['D', toSafeNumber(personalityMetrics.disc_d_pct, 0)],
      ['I', toSafeNumber(personalityMetrics.disc_i_pct, 0)],
      ['S', toSafeNumber(personalityMetrics.disc_s_pct, 0)],
      ['C', toSafeNumber(personalityMetrics.disc_c_pct, 0)],
    ] as Array<[PersonalityTraitId, number]>;

    const sorted = sortTraitEntries(entries);
    if (sorted[0]?.[1] > 0) {
      dominant = sorted[0][0];
      secondary = sorted[1]?.[0] ?? null;
    }
  }

  return {
    profile: dominant ? derivePersonalityProfileLabel(dominant, secondary) : fallbackProfile,
    subtype: dominant ? derivePersonalitySubtypeLabel(dominant, secondary) : '',
    dominant,
    secondary,
  };
};

/**
 * Cross-game behavioral enrichment for personality profiling.
 *
 * Blends self-report DISC percentages (70% weight) with behavioral signals
 * derived from the other assessment games (30% weight) to produce a more
 * accurate personality profile.
 *
 * This should be called when ALL games are complete (at assessment persist time).
 */
export const resolveEnrichedPersonality = (
  allGameMetrics: Record<string, Record<string, number | string | boolean>>,
  fallbackProfile = ''
) => {
  const personalityMetrics = allGameMetrics.personality || {};

  // Base scores from self-report (as 0-100 percentages)
  const selfReport: Record<PersonalityTraitId, number> = {
    D: toSafeNumber(personalityMetrics.disc_d_pct, 0),
    I: toSafeNumber(personalityMetrics.disc_i_pct, 0),
    S: toSafeNumber(personalityMetrics.disc_s_pct, 0),
    C: toSafeNumber(personalityMetrics.disc_c_pct, 0),
  };

  // If no self-report data, fall back to basic resolution
  const totalSelfReport = selfReport.D + selfReport.I + selfReport.S + selfReport.C;
  if (totalSelfReport === 0) {
    return resolvePersonalitySummary(personalityMetrics as any, fallbackProfile);
  }

  // ------- Cross-game behavioral signals -------
  const behavioralScores: Record<PersonalityTraitId, number> = { D: 0, I: 0, S: 0, C: 0 };

  // Leadership signals
  const leadership = allGameMetrics.leadership || {};
  const roleMatchRate = toSafeNumber(leadership.role_match_rate, 0);
  const reassignments = toSafeNumber(leadership.reassignments, 0);
  const overloadWarnings = toSafeNumber(leadership.overload_warnings, 0);
  const technicalMismatch = toSafeNumber(leadership.technical_mismatch_count, 0);

  // Good role matching + low overloads = careful/balanced (S/C)
  if (roleMatchRate >= 0.7 && overloadWarnings <= 1) {
    behavioralScores.S += 15;
    behavioralScores.C += 10;
  }
  // High reassignments + high mismatch = decisive under pressure (D)
  if (reassignments >= 3 || technicalMismatch >= 2) {
    behavioralScores.D += 15;
  }
  // Low overloads and balanced = methodical (C)
  if (overloadWarnings === 0 && roleMatchRate >= 0.6) {
    behavioralScores.C += 10;
  }

  // Risk game signals
  const risk = allGameMetrics.risk || {};
  const riskTolerance = toSafeNumber(risk.risk_tolerance, 50);
  const explosions = toSafeNumber(risk.explosions, 0);
  const holdCount = toSafeNumber(risk.hold_count, 0);
  const roundsPlayed = toSafeNumber(risk.rounds_played, 0);

  // High risk tolerance → D
  if (riskTolerance > 65) behavioralScores.D += 15;
  // Conservative (low risk + holds) → S or C
  if (riskTolerance < 40 || (holdCount > 2 && roundsPlayed > 3)) {
    behavioralScores.S += 12;
    behavioralScores.C += 8;
  }
  // Many explosions = impulsive → not C
  if (explosions >= 3) {
    behavioralScores.D += 8;
    behavioralScores.C -= 5;
  }

  // Strategy game signals
  const strategy = allGameMetrics.strategy || {};
  const dominantFocus = String(strategy.dominant_focus || '');
  const diversityIndex = toSafeNumber(strategy.diversity_index, 0);
  const adjustments = toSafeNumber(strategy.adjustments, 0);

  if (dominantFocus === 'ops') behavioralScores.D += 12;
  if (dominantFocus === 'rd') behavioralScores.D += 8;
  if (dominantFocus === 'staff') {
    behavioralScores.I += 10;
    behavioralScores.S += 10;
  }
  if (dominantFocus === 'data') behavioralScores.C += 15;

  // High diversity in allocation → balanced/S
  if (diversityIndex >= 0.85) behavioralScores.S += 10;
  // Quick decision (low adjustments) → confident/D
  if (adjustments <= 6) behavioralScores.D += 8;
  // Many adjustments → methodical/C
  if (adjustments >= 15) behavioralScores.C += 8;

  // Network game (multitask) signals
  const network = allGameMetrics.network || {};
  const accuracyPct = toSafeNumber(network.accuracy_pct, 0);
  const switchFlips = toSafeNumber(network.switch_flips, 0);

  // High accuracy → methodical (C)
  if (accuracyPct >= 80) behavioralScores.C += 12;
  // Lots of activity → energetic (I or D)
  if (switchFlips >= 8) {
    behavioralScores.I += 6;
    behavioralScores.D += 6;
  }

  // Problem-solving (crisis) signals
  const crisis = allGameMetrics.problemSolving || {};
  const empathy = toSafeNumber(crisis.empathy, 0);
  const structure = toSafeNumber(crisis.structure, 0);
  const wordCount = toSafeNumber(crisis.word_count, 0);

  if (empathy >= 70) {
    behavioralScores.S += 10;
    behavioralScores.I += 8;
  }
  if (structure >= 70) behavioralScores.C += 10;
  // Verbose communicator → I
  if (wordCount >= 60) behavioralScores.I += 8;

  // Ethics signals
  const ethics = allGameMetrics.ethics || {};
  const ethicalIntegrity = toSafeNumber(ethics.ethical_integrity, 0);
  const pressureControl = toSafeNumber(ethics.pressure_control, 0);

  // High integrity → C (rule follower)
  if (ethicalIntegrity >= 75) behavioralScores.C += 8;
  // High pressure control → resilient (D or S)
  if (pressureControl >= 70) {
    behavioralScores.D += 6;
    behavioralScores.S += 8;
  }

  // ------- Normalize behavioral scores to 0-100 scale -------
  const maxBehavioral = Math.max(...Object.values(behavioralScores), 1);
  const normalizedBehavioral: Record<PersonalityTraitId, number> = {
    D: Math.round((behavioralScores.D / maxBehavioral) * 100),
    I: Math.round((behavioralScores.I / maxBehavioral) * 100),
    S: Math.round((behavioralScores.S / maxBehavioral) * 100),
    C: Math.round((behavioralScores.C / maxBehavioral) * 100),
  };

  // ------- 70% self-report + 30% behavioral blend -------
  const SELF_WEIGHT = 0.70;
  const BEHAVIORAL_WEIGHT = 0.30;

  const blended: Array<[PersonalityTraitId, number]> = [
    ['D', selfReport.D * SELF_WEIGHT + normalizedBehavioral.D * BEHAVIORAL_WEIGHT],
    ['I', selfReport.I * SELF_WEIGHT + normalizedBehavioral.I * BEHAVIORAL_WEIGHT],
    ['S', selfReport.S * SELF_WEIGHT + normalizedBehavioral.S * BEHAVIORAL_WEIGHT],
    ['C', selfReport.C * SELF_WEIGHT + normalizedBehavioral.C * BEHAVIORAL_WEIGHT],
  ];

  const sorted = sortTraitEntries(blended);
  const dominant = sorted[0][0];
  const secondary = sorted[1][0];

  return {
    profile: derivePersonalityProfileLabel(dominant, secondary),
    subtype: derivePersonalitySubtypeLabel(dominant, secondary),
    dominant,
    secondary,
    blendedScores: {
      D: Math.round(sorted.find(([t]) => t === 'D')![1]),
      I: Math.round(sorted.find(([t]) => t === 'I')![1]),
      S: Math.round(sorted.find(([t]) => t === 'S')![1]),
      C: Math.round(sorted.find(([t]) => t === 'C')![1]),
    },
  };
};
