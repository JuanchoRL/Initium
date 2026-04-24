/**
 * Team Chemistry Engine
 *
 * Pure-logic module that calculates team composition metrics and simulates
 * the impact of adding a candidate to an existing team, using DISC compatibility.
 */

import type { PersonalityTraitId } from './personality';

// ---------------------------------------------------------------------------
// DISC Compatibility Matrix
// ---------------------------------------------------------------------------
// Values: 1 = high complementarity, 0 = neutral, -1 = moderate friction
const DISC_COMPATIBILITY: Record<PersonalityTraitId, Record<PersonalityTraitId, number>> = {
  D: { D: 0, I: 1, S: -1, C: 1 },
  I: { D: 1, I: 0, S: 1, C: -1 },
  S: { D: -1, I: 1, S: 0, C: 1 },
  C: { D: 1, I: -1, S: 1, C: 0 },
};

// Human-readable labels for compatibility levels
const COMPAT_LABELS: Record<number, string> = {
  1: 'Alta complementariedad',
  0: 'Neutro',
  [-1]: 'Fricción moderada',
};

export type TeamCompositionResult = {
  /** Count of each DISC trait in the team */
  distribution: Record<PersonalityTraitId, number>;
  /** 0-100 score: higher = more diverse team */
  diversityScore: number;
  /** Traits completely absent from the team */
  gaps: PersonalityTraitId[];
  /** Dominant trait (highest count) */
  dominantTrait: PersonalityTraitId | null;
  /** Average pairwise compatibility across team */
  avgCompatibility: number;
  /** Number of friction pairs (negative compat) */
  frictionPairs: number;
  /** Total team size */
  size: number;
};

export type CandidateFitResult = {
  /** 0-100 overall fit score */
  fitScore: number;
  /** How well the candidate fills gaps */
  complementarity: 'alta' | 'media' | 'baja';
  /** Risk of conflict with existing members */
  conflictRisk: 'bajo' | 'moderado' | 'alto';
  /** Change in diversity score if candidate is added */
  diversityDelta: number;
  /** Pairwise compatibility with each existing trait */
  compatDetails: Array<{ trait: PersonalityTraitId; count: number; compat: number; label: string }>;
  /** Human-readable summary */
  summary: string;
};

// ---------------------------------------------------------------------------
// Team Composition
// ---------------------------------------------------------------------------

export function calculateTeamComposition(members: PersonalityTraitId[]): TeamCompositionResult {
  const distribution: Record<PersonalityTraitId, number> = { D: 0, I: 0, S: 0, C: 0 };
  for (const m of members) distribution[m]++;

  const total = members.length;
  const traits: PersonalityTraitId[] = ['D', 'I', 'S', 'C'];

  // Diversity: Shannon entropy normalized to 0-100
  let entropy = 0;
  if (total > 0) {
    for (const t of traits) {
      const p = distribution[t] / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }
  }
  const maxEntropy = Math.log2(4); // max when perfectly balanced
  const diversityScore = total > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;

  // Gaps
  const gaps = traits.filter((t) => distribution[t] === 0);

  // Dominant
  let dominantTrait: PersonalityTraitId | null = null;
  let maxCount = 0;
  for (const t of traits) {
    if (distribution[t] > maxCount) {
      maxCount = distribution[t];
      dominantTrait = t;
    }
  }

  // Average pairwise compatibility
  let totalCompat = 0;
  let pairCount = 0;
  let frictionPairs = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const compat = DISC_COMPATIBILITY[members[i]][members[j]];
      totalCompat += compat;
      pairCount++;
      if (compat < 0) frictionPairs++;
    }
  }
  const avgCompatibility = pairCount > 0 ? Number((totalCompat / pairCount).toFixed(2)) : 0;

  return {
    distribution,
    diversityScore,
    gaps,
    dominantTrait,
    avgCompatibility,
    frictionPairs,
    size: total,
  };
}

// ---------------------------------------------------------------------------
// Candidate Fit Simulation
// ---------------------------------------------------------------------------

export function simulateAddCandidate(
  team: PersonalityTraitId[],
  candidateTrait: PersonalityTraitId
): CandidateFitResult {
  const currentComp = calculateTeamComposition(team);
  const newTeam = [...team, candidateTrait];
  const newComp = calculateTeamComposition(newTeam);

  const diversityDelta = newComp.diversityScore - currentComp.diversityScore;

  // Compatibility with each existing trait type
  const traits: PersonalityTraitId[] = ['D', 'I', 'S', 'C'];
  const compatDetails = traits
    .filter((t) => currentComp.distribution[t] > 0)
    .map((t) => ({
      trait: t,
      count: currentComp.distribution[t],
      compat: DISC_COMPATIBILITY[candidateTrait][t],
      label: COMPAT_LABELS[DISC_COMPATIBILITY[candidateTrait][t]] || 'Neutro',
    }));

  // Count new friction pairs introduced
  let newFrictionCount = 0;
  let newComplementCount = 0;
  for (const t of traits) {
    const compat = DISC_COMPATIBILITY[candidateTrait][t];
    const count = currentComp.distribution[t];
    if (compat < 0) newFrictionCount += count;
    if (compat > 0) newComplementCount += count;
  }

  // Complementarity: fills a gap?
  const fillsGap = currentComp.gaps.includes(candidateTrait);
  const complementarity: CandidateFitResult['complementarity'] = fillsGap
    ? 'alta'
    : newComplementCount > newFrictionCount
      ? 'media'
      : 'baja';

  // Conflict risk
  const frictionRatio = team.length > 0 ? newFrictionCount / team.length : 0;
  const conflictRisk: CandidateFitResult['conflictRisk'] =
    frictionRatio >= 0.5 ? 'alto' : frictionRatio >= 0.25 ? 'moderado' : 'bajo';

  // Fit score: weighted formula
  const gapBonus = fillsGap ? 20 : 0;
  const compatScore = team.length > 0
    ? Math.round(((newComplementCount - newFrictionCount) / team.length) * 30 + 50)
    : 70;
  const diversityBonus = Math.round(Math.max(0, diversityDelta) * 0.5);
  const fitScore = Math.min(100, Math.max(0, compatScore + gapBonus + diversityBonus));

  // Summary
  const summaryParts: string[] = [];
  if (fillsGap) summaryParts.push(`Aporta el perfil ${candidateTrait} que falta en el equipo`);
  if (conflictRisk === 'alto') summaryParts.push('Riesgo de fricción con la mayoría del equipo');
  else if (conflictRisk === 'bajo') summaryParts.push('Baja probabilidad de fricción');
  if (diversityDelta > 5) summaryParts.push('Aumenta significativamente la diversidad cognitiva');
  else if (diversityDelta < -5) summaryParts.push('Reduce la diversidad del equipo');
  const summary = summaryParts.join('. ') + '.';

  return {
    fitScore,
    complementarity,
    conflictRisk,
    diversityDelta,
    compatDetails,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the dominant DISC trait ID from a personality profile label.
 * Returns null if no match found.
 */
export function extractDominantTrait(personalityProfile: string): PersonalityTraitId | null {
  // Direct trait labels
  if (personalityProfile.includes('Impulsor Estratégico') || personalityProfile.includes('Dominante')) return 'D';
  if (personalityProfile.includes('Conector Social') || personalityProfile.includes('Influyente')) return 'I';
  if (personalityProfile.includes('Soporte Estable') || personalityProfile.includes('Estable')) return 'S';
  if (personalityProfile.includes('Analista Crítico') || personalityProfile.includes('Concienzudo')) return 'C';

  // Blended labels — first letter is dominant
  const blendMap: Record<string, PersonalityTraitId> = {
    'Líder Visionario': 'D',
    'Estratega Ejecutivo': 'D',
    'Impulsor de Equipos': 'D',
    'Catalizador Social': 'I',
    'Conector Empático': 'I',
    'Comunicador Persuasivo': 'I',
    'Facilitador Colaborativo': 'S',
    'Soporte Confiable': 'S',
    'Coordinador Sereno': 'S',
    'Analista Estratégico': 'C',
    'Especialista Metódico': 'C',
    'Curador de Calidad': 'C',
  };

  return blendMap[personalityProfile] ?? null;
}
