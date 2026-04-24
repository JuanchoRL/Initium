/**
 * Behavioral Insights Engine
 *
 * Derives human-readable behavioral patterns from existing game metrics.
 * No new data capture needed — we use what each game already records.
 */

import type { MetricsMap, GameMetrics } from '@/lib/types';

export type BehavioralSignal = 'positive' | 'neutral' | 'caution';

export type BehavioralInsight = {
  id: string;
  label: string;
  value: string;
  detail: string;
  signal: BehavioralSignal;
  icon: string; // lucide icon name
};

// ---------------------------------------------------------------------------
// Safe getters
// ---------------------------------------------------------------------------
const num = (metrics: GameMetrics | undefined, key: string, fallback = 0): number => {
  if (!metrics) return fallback;
  const v = metrics[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};

// ---------------------------------------------------------------------------
// Individual insight derivers
// ---------------------------------------------------------------------------

function deriveStrategicPlanning(strategyMetrics?: GameMetrics): BehavioralInsight | null {
  if (!strategyMetrics) return null;
  const adjustments = num(strategyMetrics, 'adjustments');
  const diversity = num(strategyMetrics, 'diversity_index');

  let value: string;
  let signal: BehavioralSignal;
  let detail: string;

  if (adjustments <= 6) {
    value = 'Decisor rápido';
    signal = diversity >= 0.7 ? 'positive' : 'caution';
    detail = `${adjustments} ajustes totales. ${diversity >= 0.7 ? 'Buena diversificación a pesar de decidir rápido.' : 'Podría beneficiarse de más análisis previo.'}`;
  } else if (adjustments <= 14) {
    value = 'Analítico';
    signal = 'positive';
    detail = `${adjustments} ajustes con índice de diversidad ${diversity}. Equilibrio entre reflexión y acción.`;
  } else {
    value = 'Hiper-reflexivo';
    signal = 'caution';
    detail = `${adjustments} ajustes sugieren dificultad para cerrar decisiones. Diversidad: ${diversity}.`;
  }

  return { id: 'strategic-planning', label: 'Planificación estratégica', value, detail, signal, icon: 'Target' };
}

function deriveLeadershipResilience(leadershipMetrics?: GameMetrics): BehavioralInsight | null {
  if (!leadershipMetrics) return null;
  const recovery = num(leadershipMetrics, 'recovery_index');
  const reassignments = num(leadershipMetrics, 'reassignments');
  const overloads = num(leadershipMetrics, 'overload_warnings');

  let value: string;
  let signal: BehavioralSignal;

  if (recovery >= 75 && overloads <= 1) {
    value = 'Alta resiliencia';
    signal = 'positive';
  } else if (recovery >= 50) {
    value = 'Resiliencia moderada';
    signal = 'neutral';
  } else {
    value = 'Bajo recuperación';
    signal = 'caution';
  }

  const detail = `Índice de recuperación: ${recovery}%. ${reassignments} reasignaciones. ${overloads} alertas de sobrecarga.`;
  return { id: 'leadership-resilience', label: 'Resiliencia bajo presión', value, detail, signal, icon: 'Shield' };
}

function deriveTeamLoadBalance(leadershipMetrics?: GameMetrics): BehavioralInsight | null {
  if (!leadershipMetrics) return null;
  const loadStd = num(leadershipMetrics, 'load_std_dev');
  const avgLoad = num(leadershipMetrics, 'avg_team_load');
  const mismatches = num(leadershipMetrics, 'mismatch_count');

  let value: string;
  let signal: BehavioralSignal;

  if (loadStd <= 8 && mismatches <= 1) {
    value = 'Distribución equilibrada';
    signal = 'positive';
  } else if (loadStd <= 15) {
    value = 'Distribución aceptable';
    signal = 'neutral';
  } else {
    value = 'Concentra la carga';
    signal = 'caution';
  }

  const detail = `Desviación de carga: ${loadStd}. Promedio: ${avgLoad}%. ${mismatches} asignaciones desalineadas.`;
  return { id: 'load-balance', label: 'Balance de carga', value, detail, signal, icon: 'Scale' };
}

function deriveRiskAppetite(riskMetrics?: GameMetrics): BehavioralInsight | null {
  if (!riskMetrics) return null;
  const tolerance = num(riskMetrics, 'risk_tolerance');
  const maxLossStreak = num(riskMetrics, 'consecutive_max_losses');
  const holds = num(riskMetrics, 'hold_count');

  let value: string;
  let signal: BehavioralSignal;

  if (tolerance >= 70) {
    value = 'Alto apetito de riesgo';
    signal = maxLossStreak <= 2 ? 'neutral' : 'caution';
  } else if (tolerance >= 40) {
    value = 'Riesgo calculado';
    signal = 'positive';
  } else {
    value = 'Conservador';
    signal = 'neutral';
  }

  const detail = `Tolerancia: ${tolerance}%. Racha de pérdidas máxima: ${maxLossStreak}. ${holds} veces optó por mantener posición.`;
  return { id: 'risk-appetite', label: 'Apetito de riesgo', value, detail, signal, icon: 'TrendingUp' };
}

function deriveCognitiveSpeed(memoryMetrics?: GameMetrics): BehavioralInsight | null {
  if (!memoryMetrics) return null;
  const avgTime = num(memoryMetrics, 'avg_pair_time_seconds');
  const attempts = num(memoryMetrics, 'attempts');
  const correct = num(memoryMetrics, 'correct_pairs');

  if (!avgTime && !attempts) return null;

  let value: string;
  let signal: BehavioralSignal;

  const accuracy = attempts > 0 ? correct / attempts : 0;

  if (avgTime > 0 && avgTime <= 3) {
    value = 'Procesamiento rápido';
    signal = accuracy >= 0.6 ? 'positive' : 'caution';
  } else if (avgTime <= 6 || !avgTime) {
    value = 'Velocidad promedio';
    signal = 'neutral';
  } else {
    value = 'Procesamiento metódico';
    signal = accuracy >= 0.7 ? 'positive' : 'neutral';
  }

  const detail = avgTime
    ? `Tiempo promedio por par: ${avgTime.toFixed(1)}s. ${correct} aciertos en ${attempts} intentos.`
    : `${correct} aciertos en ${attempts} intentos.`;
  return { id: 'cognitive-speed', label: 'Velocidad cognitiva', value, detail, signal, icon: 'Zap' };
}

function deriveMultitaskingAbility(networkMetrics?: GameMetrics): BehavioralInsight | null {
  if (!networkMetrics) return null;
  const accuracy = num(networkMetrics, 'accuracy_pct');
  const totalAttempts = num(networkMetrics, 'total_attempts');
  const correct = num(networkMetrics, 'correct_connections');

  if (!totalAttempts && !correct) return null;

  let value: string;
  let signal: BehavioralSignal;

  if (accuracy >= 80) {
    value = 'Foco simultáneo alto';
    signal = 'positive';
  } else if (accuracy >= 55) {
    value = 'Multitarea adecuada';
    signal = 'neutral';
  } else {
    value = 'Preferencia secuencial';
    signal = 'neutral';
  }

  const detail = `Precisión: ${accuracy}%. ${correct} conexiones correctas de ${totalAttempts} intentos.`;
  return { id: 'multitasking', label: 'Capacidad multitarea', value, detail, signal, icon: 'Network' };
}

function deriveDisciplineConsistency(
  strategyMetrics?: GameMetrics,
  leadershipMetrics?: GameMetrics
): BehavioralInsight | null {
  const stratAdj = strategyMetrics ? num(strategyMetrics, 'adjustments') : null;
  const leadReassign = leadershipMetrics ? num(leadershipMetrics, 'reassignments') : null;

  if (stratAdj === null && leadReassign === null) return null;

  const totalChanges = (stratAdj ?? 0) + (leadReassign ?? 0);

  let value: string;
  let signal: BehavioralSignal;

  if (totalChanges <= 5) {
    value = 'Alta consistencia';
    signal = 'positive';
  } else if (totalChanges <= 15) {
    value = 'Consistencia moderada';
    signal = 'neutral';
  } else {
    value = 'Frecuentes cambios';
    signal = 'caution';
  }

  const parts: string[] = [];
  if (stratAdj !== null) parts.push(`${stratAdj} ajustes en estrategia`);
  if (leadReassign !== null) parts.push(`${leadReassign} en liderazgo`);
  const detail = `${parts.join(', ')}. ${totalChanges <= 5 ? 'Mantiene decisiones firmes una vez tomadas.' : totalChanges <= 15 ? 'Revisa con frecuencia razonable.' : 'Tiende a dudar y cambiar dirección.'}`;

  return { id: 'consistency', label: 'Consistencia decisional', value, detail, signal, icon: 'Crosshair' };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function deriveBehavioralInsights(metricsMap: MetricsMap | Record<string, GameMetrics>): BehavioralInsight[] {
  const insights: BehavioralInsight[] = [];

  const strategy = metricsMap.strategy as GameMetrics | undefined;
  const leadership = metricsMap.leadership as GameMetrics | undefined;
  const risk = metricsMap.risk as GameMetrics | undefined;
  const memory = metricsMap.memory as GameMetrics | undefined;
  const network = metricsMap.network as GameMetrics | undefined;

  const fns = [
    deriveStrategicPlanning(strategy),
    deriveLeadershipResilience(leadership),
    deriveTeamLoadBalance(leadership),
    deriveRiskAppetite(risk),
    deriveCognitiveSpeed(memory),
    deriveMultitaskingAbility(network),
    deriveDisciplineConsistency(strategy, leadership),
  ];

  for (const insight of fns) {
    if (insight) insights.push(insight);
  }

  return insights;
}
