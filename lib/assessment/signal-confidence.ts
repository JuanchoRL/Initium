import { PERFORMANCE_GAME_IDS } from '@/lib/constants';
import { clamp, toSafeNumber } from '@/lib/math';
import type { MetricsMap, ScoresMap } from '@/lib/types';

export type SignalTone = 'good' | 'warn' | 'risk';

export type SignalQualityPack = {
  score: number;
  label: string;
  tone: SignalTone;
  summary: string;
  checks: string[];
};

export const getSignalTone = (score: number): SignalTone => {
  if (score >= 75) return 'good';
  if (score >= 60) return 'warn';
  return 'risk';
};

const getStdDev = (values: number[]) => {
  if (!values.length) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
};

export const buildSignalQuality = (scores: ScoresMap, metrics: MetricsMap): SignalQualityPack => {
  const performanceScores = PERFORMANCE_GAME_IDS.map((gameId) => toSafeNumber(scores[gameId], 0));
  const completedAssessments = performanceScores.filter((score) => score > 0).length;
  const completeness = Math.round((completedAssessments / PERFORMANCE_GAME_IDS.length) * 100);
  const consistency = clamp(Math.round(100 - getStdDev(performanceScores) * 1.2), 0, 100);

  const leadershipDecisions = toSafeNumber(metrics.leadership.total_assigned, 0);
  const routingActions = toSafeNumber(metrics.network.switch_flips, 0);
  const riskRounds = toSafeNumber(metrics.risk.rounds_played, 0);
  const crisisWords = toSafeNumber(metrics.problemSolving.word_count, 0);
  const ethicsResolvedCases = toSafeNumber(metrics.ethics.resolved_cases, 0);
  const ethicsIntegrity = toSafeNumber(metrics.ethics.ethical_integrity, 0);
  const behaviorDepth = clamp(
    (leadershipDecisions >= 3 ? 25 : 10) +
      (routingActions >= 4 ? 25 : 10) +
      (riskRounds >= 5 ? 25 : 10) +
      (crisisWords >= 40 ? 15 : 8) +
      (ethicsResolvedCases >= 2 ? 8 : 0) +
      (ethicsIntegrity >= 60 ? 7 : 0),
    0,
    100
  );

  const score = clamp(Math.round(completeness * 0.45 + consistency * 0.25 + behaviorDepth * 0.3), 0, 100);
  const tone = getSignalTone(score);
  const label = tone === 'good' ? 'Alta' : tone === 'warn' ? 'Media' : 'Baja';
  const summary =
    tone === 'good'
      ? 'El informe tiene buena cobertura y señales consistentes para tomar decisiones.'
      : tone === 'warn'
        ? 'El informe es usable, pero conviene validar en entrevista los ejes más débiles.'
        : 'La señal es limitada; se recomienda agregar evidencia antes de decidir.';

  return {
    score,
    label,
    tone,
    summary,
    checks: [
      `Cobertura de evaluación: ${completeness}%`,
      `Consistencia entre pruebas: ${consistency}%`,
      `Profundidad conductual capturada: ${behaviorDepth}%`,
    ],
  };
};
