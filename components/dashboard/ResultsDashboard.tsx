import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Activity,
  Clipboard,
  Save,
  RotateCcw,
  Briefcase,
  UserCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Card, Button } from '@/components/ui/core';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { MetricDeepDiveModal } from './MetricDeepDiveModal';
import { clamp, toSafeNumber } from '@/lib/math';
import { PERFORMANCE_GAME_IDS } from '@/lib/constants';
import { buildSignalQuality, getSignalTone, type SignalTone } from '@/lib/assessment/signal-confidence';
import type { CandidateProfile, ScoresMap, MetricsMap, AccessType, GameId, GameMetrics } from '@/lib/types';
import { PERSONALITY_QUESTIONS } from '@/app/games/personality/GamePersonality';
import { resolvePersonalitySummary } from '@/lib/assessment/personality';
import { exportDashboardToPdf } from '@/lib/pdf-export';

type RecruiterInsightPack = {
  decision: {
    title: string;
    summary: string;
    tone: SignalTone;
  };
  executiveSummary: string[];
  quickView: Array<{
    label: string;
    value: string;
    detail: string;
    tone: SignalTone;
  }>;
  strengths: string[];
  risks: string[];
  flightRisk: { hasRisk: boolean; reason: string };
  crossMetricQuestion: string;
  interviewFocus: string[];
  interviewGuide: Array<{
    question: string;
    signal: string;
  }>;
};

type CandidateSummaryPack = {
  title: string;
  snapshot: string;
  topArea: string;
  focusArea: string;
  superpowers: Array<{ gameId: GameId; badge: string; score: number }>;
  cultureMatch: string;
  flowZone: string;
  strengths: string[];
  developmentAreas: string[];
  nextSteps: string[];
  weeklyPlan: string[];
};

type ProfileNarrativePack = {
  headline: string;
  interpretation: string;
  strengths: string[];
  weaknesses: string[];
  actionPlan: string[];
};

const DashboardHint = ({ text, testId }: { text: string; testId?: string }) => (
  <span
    title={text}
    data-testid={testId}
    className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-cyan-200 text-cyan-700 bg-cyan-50 cursor-help ml-2"
    aria-label={text}
  >
    <Info className="w-3 h-3" />
  </span>
);

const ScoreLegend = ({ mode }: { mode: AccessType }) => (
  <div
    data-testid={mode === 'recruiter' ? 'recruiter-score-legend' : 'candidate-score-legend'}
    className="rounded-lg border border-stone-200 bg-white p-3"
  >
    <div className="text-[11px] uppercase tracking-wide font-bold text-stone-500 mb-2">
      {mode === 'recruiter' ? 'Cómo leer señales' : 'Cómo leer tu resultado'}
    </div>
    <div className="flex flex-wrap gap-2 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
        Fuerte 75-100
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200">
        Intermedio 60-74
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200">
        A validar 0-59
      </span>
    </div>
    <p className="text-xs text-stone-600">
      {mode === 'recruiter'
        ? 'Rojo no implica descarte automático: indica dónde pedir evidencia puntual en entrevista.'
        : 'Las áreas en ámbar y rojo son oportunidades concretas de mejora, no errores definitivos.'}
    </p>
  </div>
);

const getSignalLabel = (score: number) => {
  if (score >= 80) return 'Alto';
  if (score >= 65) return 'Medio';
  return 'Bajo';
};

const toneToBadge = (tone: SignalTone) => {
  if (tone === 'good') return { label: 'Fuerte', style: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (tone === 'warn') return { label: 'Intermedio', style: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'A validar', style: 'bg-red-100 text-red-700 border-red-200' };
};

const toneToInterpretation = (tone: SignalTone) => {
  if (tone === 'good') return 'Comportamiento consistente en este eje.';
  if (tone === 'warn') return 'Base aceptable, conviene validar profundidad.';
  return 'Señal inestable; requiere evidencia adicional.';
};

const gameInsightText: Record<GameId, { strong: string; weak: string }> = {
  personality: {
    strong: 'Muestra un estilo de colaboración claro y consistente.',
    weak: 'Aún no muestra un estilo de colaboración consistente en todos los contextos.',
  },
  memory: {
    strong: 'Recuerda patrones y reproduce estructuras con buena precisión.',
    weak: 'Puede mejorar la retención visual y la reconstrucción de patrones.',
  },
  leadership: {
    strong: 'Distribuye tareas con criterio y balancea mejor la carga del equipo.',
    weak: 'Necesita reforzar criterio de asignación y distribución de carga.',
  },
  problemSolving: {
    strong: 'Comunica planes de acción claros y ordenados en escenarios críticos.',
    weak: 'Conviene mejorar estructura y claridad del plan en situaciones de crisis.',
  },
  ethics: {
    strong: 'Sostiene criterio ético consistente incluso cuando aumentan la presión y el conflicto de intereses.',
    weak: 'Necesita mayor consistencia ética y claridad al decidir entre presión jerárquica, regla y daño humano.',
  },
  risk: {
    strong: 'Gestiona bien el riesgo y mantiene control en momentos de presión.',
    weak: 'Le cuesta sostener consistencia cuando sube el nivel de incertidumbre.',
  },
  network: {
    strong: 'Mantiene buen foco con múltiples frentes activos en paralelo.',
    weak: 'Puede mejorar atención dividida cuando hay varios estímulos simultáneos.',
  },
  strategy: {
    strong: 'Define prioridades con una lógica estratégica consistente.',
    weak: 'Necesita mayor consistencia al priorizar recursos estratégicos.',
  },
};

const getScoreBand = (score: number) => {
  if (score >= 80) return { label: 'Alto', color: 'text-green-600' };
  if (score >= 60) return { label: 'Medio', color: 'text-yellow-600' };
  return { label: 'Base', color: 'text-stone-600' };
};

const gameLabelById: Record<GameId, string> = {
  personality: 'arquetipo',
  memory: 'memoria',
  leadership: 'gestión',
  problemSolving: 'crisis',
  ethics: 'ética',
  risk: 'riesgo',
  network: 'multitarea',
  strategy: 'estrategia',
};

const getReadableTier = (score: number) => {
  if (score >= 80) return 'alto';
  if (score >= 65) return 'medio-alto';
  if (score >= 50) return 'medio';
  return 'en desarrollo';
};

const strategyFocusLabel = (strategyProfile: string) => {
  if (strategyProfile === 'ops') return 'foco en resultados inmediatos';
  if (strategyProfile === 'staff') return 'foco en personas y continuidad del equipo';
  if (strategyProfile === 'data') return 'foco en control, riesgo y calidad de procesos';
  if (strategyProfile === 'rd') return 'foco en innovacion y largo plazo';
  return 'sin dominancia marcada';
};

const getSuperpowerBadge = (gameId: string) => {
  const badges: Record<string, string> = {
    personality: 'Colaborador Estratégico',
    memory: 'Mente de Acero',
    leadership: 'Líder Nato',
    problemSolving: 'Resolutivo en Crisis',
    ethics: 'Brújula Moral',
    risk: 'Gestor del Riesgo',
    network: 'Mente Multitarea',
    strategy: 'Arquitecto Visionario',
  };
  return badges[gameId] || 'Especialista';
};

const getCultureMatch = (strategy: string, riskScore: number) => {
  if (strategy === 'ops' && riskScore < 60) return 'Culturas Corporativas y Operaciones Estables';
  if (strategy === 'rd' && riskScore >= 70) return 'Startups Dinámicas e Innovación Disruptiva';
  if (strategy === 'data') return 'Empresas Financieras, Auditoría y Control de Calidad';
  if (strategy === 'staff') return 'Recursos Humanos, ONGs y Liderazgo Transformacional';
  return 'Entornos Mixtos y Agiles';
};

const getFlowZone = (strategy: string) => {
  if (strategy === 'ops') return 'Entregando resultados inmediatos y optimizando flujos operativos.';
  if (strategy === 'rd') return 'Diseñando soluciones desde cero y asumiendo desafíos innovadores.';
  if (strategy === 'data') return 'Analizando métricas profundas y asegurando control de calidad.';
  if (strategy === 'staff') return 'Mentoreando equipos y resolviendo cuellos de botella humanos.';
  return 'Liderando iniciativas versátiles que requieran tanto visión como ejecución plana.';
};

const getRiskLoadLabel = (riskLoad: number) => {
  if (riskLoad <= 25) return 'Bajo';
  if (riskLoad <= 55) return 'Medio';
  return 'Alto';
};

const buildRecruiterInsights = (
  scores: ScoresMap,
  metrics: MetricsMap,
  strategyProfile: string,
  personalityProfile: string
): RecruiterInsightPack => {
  const performanceRows = PERFORMANCE_GAME_IDS.map((gameId) => [gameId, toSafeNumber(scores[gameId as keyof ScoresMap], 0)] as const);
  const overall = Math.round(performanceRows.reduce((sum, [, score]) => sum + score, 0) / performanceRows.length);
  const topAreas = [...performanceRows].sort((a, b) => b[1] - a[1]);
  const lowAreas = [...performanceRows].sort((a, b) => a[1] - b[1]);

  const roleMatchRate = Math.round(toSafeNumber(metrics.leadership.role_match_rate, 0) * 100);
  const technicalMismatch = toSafeNumber(metrics.leadership.technical_mismatch_count, 0);
  const overloads = toSafeNumber(metrics.leadership.overload_warnings, 0);
  const mismatchCount = toSafeNumber(metrics.leadership.mismatch_count, 0);
  const empathy = toSafeNumber(metrics.problemSolving.empathy, 0);
  const structure = toSafeNumber(metrics.problemSolving.structure, 0);
  const decisiveness = toSafeNumber(metrics.problemSolving.decisiveness, 0);
  const communicationScore = Math.round((empathy + structure + decisiveness) / 3);
  const ethicsIntegrity = toSafeNumber(metrics.ethics.ethical_integrity, scores.ethics);
  const ethicsConsistency = toSafeNumber(metrics.ethics.decision_consistency, scores.ethics);
  const ethicsPressure = toSafeNumber(metrics.ethics.pressure_control, scores.ethics);
  const ethicsEmpathy = toSafeNumber(metrics.ethics.human_empathy, scores.ethics);
  const ethicsComposite = Math.round((ethicsIntegrity + ethicsConsistency + ethicsPressure + ethicsEmpathy) / 4);
  const riskControl = scores.risk;
  const multitask = scores.network;
  const explosions = toSafeNumber(metrics.risk.explosions, 0);
  const pressureScore = clamp(Math.round(riskControl * 0.58 + multitask * 0.42 - explosions * 4), 0, 100);
  const assignmentRiskLoad = clamp(Math.round(technicalMismatch * 14 + overloads * 16 + mismatchCount * 8), 0, 100);
  const readinessScore = clamp(
    Math.round(
      overall * 0.36 +
        roleMatchRate * 0.2 +
        communicationScore * 0.16 +
        pressureScore * 0.13 +
        ethicsComposite * 0.15 -
        assignmentRiskLoad * 0.12
    ),
    0,
    100
  );

  const decisionTone: 'good' | 'warn' | 'risk' =
    readinessScore >= 78 && technicalMismatch <= 1 && overloads <= 2
      ? 'good'
      : readinessScore >= 62
        ? 'warn'
        : 'risk';

  const recommendationTitle =
    decisionTone === 'good'
      ? 'Recomendado para avanzar a entrevista final'
      : decisionTone === 'warn'
        ? 'Avanzar con entrevista estructurada'
        : 'Requiere validación adicional';

  const recommendationSummary =
    decisionTone === 'good'
      ? 'El perfil muestra señales sólidas en ejecución, coordinación y estabilidad bajo presión.'
      : decisionTone === 'warn'
        ? 'Hay base para avanzar, pero conviene validar consistencia en tareas críticas.'
        : 'Conviene sumar evidencia antes de tomar una decisión de avance.';

  const strengths: string[] = [];
  if (readinessScore >= 75) strengths.push('Se adapta bien al tipo de exigencia del rol objetivo.');
  if (roleMatchRate >= 70) strengths.push('Demuestra criterio para asignar tareas y priorizar recursos.');
  if (communicationScore >= 70) strengths.push('Comunica con claridad y mantiene foco en las personas afectadas.');
  if (pressureScore >= 70) strengths.push('Sostiene buen rendimiento cuando aumenta la presión operativa.');
  if (ethicsComposite >= 72) strengths.push('Mantiene criterio ético usable aun frente a presión social y jerárquica.');
  if (personalityProfile) strengths.push(`Estilo de colaboración predominante: ${personalityProfile}.`);
  if (!strengths.length) strengths.push('Muestra disposición para adaptarse y sostener continuidad operativa.');

  const risks: string[] = [];
  if (technicalMismatch > 0) risks.push('Aparecen asignaciones con encaje bajo en tareas de alta exigencia.');
  if (overloads > 1) risks.push('Se concentra demasiada carga en parte del equipo.');
  if (communicationScore < 65) risks.push('En crisis, la comunicación pierde claridad y estructura.');
  if (pressureScore < 60 || explosions > 2) risks.push('El rendimiento cae cuando la presión sube rápidamente.');
  if (mismatchCount > 2) risks.push('El criterio de asignación se vuelve inestable al aumentar complejidad.');
  if (ethicsComposite < 60) risks.push('El criterio ético se vuelve inestable ante conflicto de intereses o presión externa.');
  if (!risks.length) risks.push('No se detectan riesgos críticos en esta evaluación.');

  const interviewFocus: string[] = [];
  interviewFocus.push('Pedir un caso real de priorización con tiempo y recursos limitados.');
  if (technicalMismatch > 0 || mismatchCount > 2) {
    interviewFocus.push('Profundizar cómo decide quién toma cada tarea crítica y qué criterio utiliza.');
  }
  if (ethicsComposite < 72) {
    interviewFocus.push('Contrastar cómo responde cuando la regla, la lealtad grupal y la presión jerárquica chocan entre sí.');
  }
  if (communicationScore < 70) {
    interviewFocus.push('Solicitar un mensaje de crisis para validar claridad, estructura y empatía.');
  } else {
    interviewFocus.push('Validar cómo sostiene comunicación consistente durante incidentes prolongados.');
  }
  if (pressureScore < 70) {
    interviewFocus.push('Explorar qué mecanismos usa para mantener precisión bajo presión.');
  } else {
    interviewFocus.push('Contrastar desempeño con múltiples frentes simultáneos.');
  }

  const executiveSummary = [
    `Estado general: ${getSignalLabel(readinessScore)} (${readinessScore}/100).`,
    `Fortaleza principal: ${strengths[0] || 'Perfil con ejecución estable.'}`,
    `Riesgo principal: ${risks[0] || 'Sin riesgo crítico detectado.'}`,
  ];

  const interviewGuide: Array<{ question: string; signal: string }> = [];
  if (technicalMismatch > 0 || mismatchCount > 2) {
    interviewGuide.push({
      question: 'Cuéntame un caso donde tuviste que reasignar tareas críticas en tiempo real. ¿Qué criterio usaste?',
      signal: 'Debe explicitar criterio por capacidad, urgencia e impacto, no por intuición aislada.',
    });
  }
  if (ethicsComposite < 74) {
    interviewGuide.push({
      question: 'Describe una situación donde un compañero te pidió encubrir algo incorrecto mientras un líder te exigía una acción agresiva. ¿Cómo decidirías?',
      signal: 'Se espera una respuesta con límites claros, criterio legal/ético y consistencia aun bajo presión cruzada.',
    });
  }
  if (communicationScore < 72) {
    interviewGuide.push({
      question: 'Simula un mensaje de crisis para stakeholders en 60 segundos: ¿qué dices primero y por qué?',
      signal: 'Se espera estructura: impacto, acción inmediata, responsables y siguiente actualización.',
    });
  }
  if (pressureScore < 72) {
    interviewGuide.push({
      question: '¿Cómo evitas errores cuando sube la presión y llegan varios frentes simultáneos?',
      signal: 'Debe mostrar método operativo concreto: priorización, checkpoints y control de calidad mínimo.',
    });
  }
  if (assignmentRiskLoad > 40) {
    interviewGuide.push({
      question: '¿Qué señales usas para detectar sobrecarga del equipo antes de que afecte resultados?',
      signal: 'Debe mencionar indicadores tempranos y acciones preventivas de redistribución.',
    });
  }
  if (interviewGuide.length < 3) {
    interviewGuide.push({
      question: 'Describe una decisión difícil de priorización y cómo defendiste tu criterio ante el equipo.',
      signal: 'Debe equilibrar resultado, riesgo y comunicación con las personas involucradas.',
    });
  }

  return {
    decision: {
      title: recommendationTitle,
      summary: recommendationSummary,
      tone: decisionTone,
    },
    executiveSummary,
    quickView: [
      {
        label: 'Preparación general para el rol',
        value: `${getSignalLabel(readinessScore)} (${readinessScore}/100)`,
        detail: 'Combina desempeño global, coordinación, comunicación y presión.',
        tone: getSignalTone(readinessScore),
      },
      {
        label: 'Criterio de asignación de tareas',
        value: `${getSignalLabel(roleMatchRate)} (${roleMatchRate}%)`,
        detail: 'Mide si las tareas quedaron en personas con mejor encaje.',
        tone: getSignalTone(roleMatchRate),
      },
      {
        label: 'Comunicación en crisis',
        value: `${getSignalLabel(communicationScore)} (${communicationScore}/100)`,
        detail: 'Evalúa claridad, orden y foco humano en la respuesta escrita.',
        tone: getSignalTone(communicationScore),
      },
      {
        label: 'Criterio ético bajo presión',
        value: `${getSignalLabel(ethicsComposite)} (${ethicsComposite}/100)`,
        detail: 'Combina integridad, consistencia y respuesta frente a presión social y jerárquica.',
        tone: getSignalTone(ethicsComposite),
      },
      {
        label: 'Rendimiento bajo presión',
        value: `${getSignalLabel(pressureScore)} (${pressureScore}/100)`,
        detail: 'Combina control de riesgo y multitarea en tiempo real.',
        tone: getSignalTone(pressureScore),
      },
      {
        label: 'Riesgo de sobrecarga operativa',
        value: getRiskLoadLabel(assignmentRiskLoad),
        detail: `Alertas observadas: ${overloads}. Desajustes críticos: ${technicalMismatch}.`,
        tone: assignmentRiskLoad <= 25 ? 'good' : assignmentRiskLoad <= 55 ? 'warn' : 'risk',
      },
      {
        label: 'Enfoque estratégico dominante',
        value: strategyFocusLabel(strategyProfile),
        detail: 'Muestra dónde tiende a priorizar recursos en trade-offs.',
        tone: 'warn',
      },
    ],
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
    flightRisk: {
      hasRisk: overall > 85 && (ethicsComposite < 50 || riskControl < 40),
      reason: 'Candidato hiper-competente pero con señales de alta volatilidad ética/riesgo. Podría aburrirse rápido o desafiar reglas en culturas burocráticas.'
    },
    crossMetricQuestion: `Notamos que tu fortaleza en ${gameLabelById[topAreas[0]?.[0] || 'strategy']} es excelente, pero el área de ${gameLabelById[lowAreas[0]?.[0] || 'risk']} fue más baja. ¿Cómo compensas esa debilidad usando tu fortaleza principal en el día a día?`,
    interviewFocus: interviewFocus.slice(0, 3),
    interviewGuide: interviewGuide.slice(0, 3),
  };
};

const buildCandidateSummary = (
  scores: ScoresMap,
  _metrics: MetricsMap,
  strategyProfile: string,
  personalityProfile: string
): CandidateSummaryPack => {
  const performanceRows = PERFORMANCE_GAME_IDS.map((gameId) => [gameId, toSafeNumber(scores[gameId as keyof ScoresMap], 0)] as const);
  const overall = Math.round(performanceRows.reduce((sum, [, score]) => sum + score, 0) / performanceRows.length);
  const lowAreas = performanceRows.filter(([, score]) => score < 65);
  const topAreas = [...performanceRows].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const topAreaLabel = topAreas[0] ? gameLabelById[topAreas[0][0]] : 'perfil general';
  const focusAreaLabel = lowAreas[0] ? gameLabelById[lowAreas[0][0]] : 'ninguna crítica';

  const superpowers = topAreas.filter(([, score]) => score >= 70).map(([gameId, score]) => ({
    gameId: gameId as GameId,
    badge: getSuperpowerBadge(gameId),
    score
  }));

  const strengths = topAreas.map(([gameId]) => gameInsightText[gameId].strong);
  if (personalityProfile) strengths.push(`Tu estilo de colaboración dominante fue ${personalityProfile}.`);

  const developmentAreas =
    lowAreas.length > 0
      ? lowAreas.slice(0, 2).map(([gameId]) => gameInsightText[gameId].weak)
      : ['Mostraste un perfil equilibrado; mantén esta consistencia en escenarios de mayor presión.'];

  const title =
    overall >= 80
      ? 'Perfil sólido y competitivo'
      : overall >= 65
        ? 'Perfil con buena base de desempeño'
        : 'Perfil en construcción';

  const snapshot =
    overall >= 80
      ? `Lograste un rendimiento alto y consistente en la mayoría de los desafíos.`
      : overall >= 65
        ? `Mostraste buenos fundamentos y margen claro para seguir mejorando.`
        : `Mostraste potencial, pero todavía hay áreas importantes para fortalecer.`;

  const nextSteps = [
    'Practica decisiones con límite de tiempo para mejorar consistencia.',
    lowAreas.length > 0
      ? `Refuerza especialmente ${gameLabelById[lowAreas[0][0]]} con ejercicios cortos y frecuentes.`
      : 'Sostén tu nivel con práctica semanal y revisión de errores.',
    `Mantén tu enfoque estratégico actual: ${strategyFocusLabel(strategyProfile)}.`,
  ];

  const weeklyPlan = [
    `Semana 1: repaso corto de ${focusAreaLabel} con ejercicios de 10 minutos por día.`,
    'Semana 2: simula escenarios con tiempo límite y revisa decisiones al final de cada intento.',
    `Semana 3: aplica tu fortaleza en ${topAreaLabel} para apoyar la mejora del área más débil.`,
  ];

  return {
    title,
    snapshot,
    topArea: topAreaLabel,
    focusArea: focusAreaLabel,
    superpowers,
    cultureMatch: getCultureMatch(strategyProfile, scores.risk),
    flowZone: getFlowZone(strategyProfile),
    strengths: strengths.slice(0, 3),
    developmentAreas: developmentAreas.slice(0, 3),
    nextSteps,
    weeklyPlan,
  };
};

const buildProfileNarrative = (
  scores: ScoresMap,
  strategyProfile: string,
  personalityProfile: string
): ProfileNarrativePack => {
  const performanceRows = PERFORMANCE_GAME_IDS.map((gameId) => [gameId, toSafeNumber(scores[gameId as keyof ScoresMap], 0)] as const);
  const strongest = [...performanceRows].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const weakest = [...performanceRows].sort((a, b) => a[1] - b[1]).slice(0, 2);
  const overall = Math.round(performanceRows.reduce((sum, [, score]) => sum + score, 0) / performanceRows.length);
  const levelText = getReadableTier(overall);
  const topLabel = strongest.map(([gameId]) => gameLabelById[gameId]).join(' y ');
  const weakLabel = weakest.map(([gameId]) => gameLabelById[gameId]).join(' y ');

  const strengths = strongest.map(([gameId, score]) => {
    const title = gameLabelById[gameId].charAt(0).toUpperCase() + gameLabelById[gameId].slice(1);
    return `${title}: ${score}/100. ${gameInsightText[gameId].strong}`;
  });

  const weaknesses = weakest.map(([gameId, score]) => {
    const title = gameLabelById[gameId].charAt(0).toUpperCase() + gameLabelById[gameId].slice(1);
    return `${title}: ${score}/100. ${gameInsightText[gameId].weak}`;
  });

  const actionPlan = [
    weakLabel
      ? `Plan de mejora sugerido: entrenar semanalmente ${weakLabel} con escenarios cortos y feedback inmediato.`
      : 'Plan de mejora sugerido: sostener práctica semanal para mantener consistencia.',
    `Mantener y escalar fortalezas de ${topLabel || 'las áreas principales'} hacia escenarios con más presión.`,
    `${personalityProfile ? `Estilo de colaboración observado: ${personalityProfile}. ` : ''}Enfoque estratégico actual: ${strategyFocusLabel(strategyProfile)}.`,
  ];

  const headline =
    overall >= 80
      ? 'Perfil con desempeño alto y consistente'
      : overall >= 65
        ? 'Perfil sólido con áreas puntuales a reforzar'
        : 'Perfil con potencial, requiere consolidación';

  return {
    headline,
    interpretation: `Rendimiento general ${levelText} (${overall}/100). Las señales más fuertes se vieron en ${topLabel || 'los ejes principales'}, mientras que ${weakLabel || 'algunas áreas'} requiere mayor consistencia.`,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    actionPlan,
  };
};

const getPersonalityDashboardData = (personalityMetrics: Record<string, any>) => {
  const traitRows = [
    { key: 'disc_d_pct', label: 'Dominante', value: Math.round(toSafeNumber(personalityMetrics.disc_d_pct, 0)), color: 'bg-blue-500' },
    { key: 'disc_i_pct', label: 'Influyente', value: Math.round(toSafeNumber(personalityMetrics.disc_i_pct, 0)), color: 'bg-amber-500' },
    { key: 'disc_s_pct', label: 'Estable', value: Math.round(toSafeNumber(personalityMetrics.disc_s_pct, 0)), color: 'bg-emerald-500' },
    { key: 'disc_c_pct', label: 'Concienzudo', value: Math.round(toSafeNumber(personalityMetrics.disc_c_pct, 0)), color: 'bg-purple-500' },
  ];
  const questionRows = PERSONALITY_QUESTIONS.map((question: any, index: number) => {
    const key = index + 1;
    const rawChoice = String(personalityMetrics[`q${key}_choice`] || '');
    const selectedOption = question.options.find((opt: any) => opt.id === rawChoice);
    const rawSignal = personalityMetrics[`q${key}_signal`];
    const signal =
      typeof rawSignal === 'string' && rawSignal.trim().length > 0 ? rawSignal : selectedOption?.signal || 'Sin señal registrada';

    return {
      id: question.id,
      questionLabel: question.title,
      measure: question.measure,
      selectedAnswer: selectedOption ? `${selectedOption.id}) ${selectedOption.text}` : 'Sin respuesta registrada',
      signal,
    };
  });

  return { traitRows, questionRows };
};

export const ResultsDashboard = ({
  candidate,
  scores,
  metrics,
  strategyProfile,
  personalityProfile,
  onRestart,
}: {
  candidate: CandidateProfile;
  scores: ScoresMap;
  metrics: MetricsMap;
  strategyProfile: string;
  personalityProfile: string;
  onRestart: () => void;
}) => {
  const dashboardView: AccessType = candidate.accessType === 'recruiter' ? 'recruiter' : 'candidate';
  const [showPersonalityDetails, setShowPersonalityDetails] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [selectedDeepDive, setSelectedDeepDive] = useState<GameId | null>(null);

  const personalitySummary = useMemo(
    () => resolvePersonalitySummary(metrics.personality as any, personalityProfile),
    [metrics.personality, personalityProfile]
  );
  const effectivePersonalityProfile = personalitySummary.profile;
  const effectivePersonalitySubtype = personalitySummary.subtype;

  const radarData = [
    { subject: 'Memoria', score: scores.memory, fullMark: 100, idealScore: 70, gameId: 'memory' as GameId },
    { subject: 'Gestión', score: scores.leadership, fullMark: 100, idealScore: 80, gameId: 'leadership' as GameId },
    { subject: 'Crisis', score: scores.problemSolving, fullMark: 100, idealScore: 85, gameId: 'problemSolving' as GameId },
    { subject: 'Ética', score: scores.ethics, fullMark: 100, idealScore: 90, gameId: 'ethics' as GameId },
    { subject: 'Riesgo', score: scores.risk, fullMark: 100, idealScore: 65, gameId: 'risk' as GameId },
    { subject: 'Multitarea', score: scores.network, fullMark: 100, idealScore: 75, gameId: 'network' as GameId },
    { subject: 'Estrategia', score: scores.strategy, fullMark: 100, idealScore: 80, gameId: 'strategy' as GameId },
  ];

  const timelineData = PERFORMANCE_GAME_IDS.map((gId, index) => ({
    name: gameLabelById[gId].charAt(0).toUpperCase() + gameLabelById[gId].slice(1),
    score: toSafeNumber(scores[gId], 0),
    index: index + 1
  })).filter(item => item.score > 0);

  const recruiterPack = useMemo(
    () => buildRecruiterInsights(scores, metrics, strategyProfile, effectivePersonalityProfile),
    [scores, metrics, strategyProfile, effectivePersonalityProfile]
  );

  const candidateSummary = useMemo(
    () => buildCandidateSummary(scores, metrics, strategyProfile, effectivePersonalityProfile),
    [scores, metrics, strategyProfile, effectivePersonalityProfile]
  );
  const profileNarrative = useMemo(
    () => buildProfileNarrative(scores, strategyProfile, effectivePersonalityProfile),
    [scores, strategyProfile, effectivePersonalityProfile]
  );
  const signalQuality = useMemo(() => buildSignalQuality(scores, metrics), [scores, metrics]);

  const overall = Math.round(
    PERFORMANCE_GAME_IDS.reduce((sum, gameId) => sum + toSafeNumber(scores[gameId as keyof ScoresMap], 0), 0) / PERFORMANCE_GAME_IDS.length
  );
  const personalityData = useMemo(() => getPersonalityDashboardData(metrics.personality || {}), [metrics.personality]);

  const shareSummaryText = useMemo(() => {
    if (dashboardView === 'recruiter') {
      return [
        `Informe Initium - ${candidate.name}`,
        `Decision sugerida: ${recruiterPack.decision.title}`,
        `Índice global: ${overall}/100`,
        `Confiabilidad de señal: ${signalQuality.label} (${signalQuality.score}/100)`,
        `Fortaleza principal: ${recruiterPack.strengths[0] || 'Sin registro'}`,
        `Riesgo principal: ${recruiterPack.risks[0] || 'Sin riesgo crítico'}`,
        `Foco entrevista: ${recruiterPack.interviewFocus[0] || 'Sin foco definido'}`,
      ].join('\n');
    }
    return [
      `Resumen Initium - ${candidate.name}`,
      `${candidateSummary.title} (${overall}/100)`,
      `Tu mejor eje: ${candidateSummary.topArea}`,
      `Eje a reforzar: ${candidateSummary.focusArea}`,
      `Siguiente paso: ${candidateSummary.nextSteps[0] || 'Mantener práctica regular.'}`,
    ].join('\n');
  }, [dashboardView, candidate.name, recruiterPack, overall, signalQuality, candidateSummary]);

  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = useCallback(async () => {
    if (!dashboardRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const filename = `evaluacion-${candidate.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      await exportDashboardToPdf(dashboardRef.current, filename);
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setIsExporting(false);
    }
  }, [candidate.name, isExporting]);

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(shareSummaryText);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1800);
    } catch {
      setCopyStatus('error');
      window.setTimeout(() => setCopyStatus('idle'), 1800);
    }
  };

  return (
    <div ref={dashboardRef} className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in pt-8 pb-20 px-4 print:space-y-4 print:pt-0 print:pb-0">

      {selectedDeepDive && (
        <MetricDeepDiveModal
          gameId={selectedDeepDive}
          score={toSafeNumber(scores[selectedDeepDive], 0)}
          metrics={metrics[selectedDeepDive] || {}}
          onClose={() => setSelectedDeepDive(null)}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-end border-b border-stone-200 pb-6 gap-4 print:border-b-2 print:border-stone-800">
        <div>
          <h2 className="text-3xl font-bold text-stone-800 tracking-tight">{candidate.name}</h2>
          <p className="text-stone-500 text-sm mt-1">
            {candidate.role || 'Rol no informado'} | {candidate.email}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-xs text-stone-400">Índice global: {overall}/100</p>
            <span className="text-[10px] uppercase tracking-wide font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-full">
              {dashboardView === 'recruiter' ? 'Modo recruiter' : 'Modo candidato'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopySummary} data-testid="copy-summary-btn">
            <Clipboard className="w-4 h-4 mr-2" /> {copyStatus === 'copied' ? 'Copiado' : copyStatus === 'error' ? 'Error al copiar' : 'Copiar resumen'}
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={isExporting}>
            {isExporting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando PDF...</>
              : <><Save className="w-4 h-4 mr-2" /> Exportar informe</>}
          </Button>
          <Button variant="secondary" onClick={onRestart}>
            <RotateCcw className="w-4 h-4 mr-2" /> Nueva evaluación
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] gap-8 items-start">
        <Card>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-stone-700 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-600" /> Mapa de competencias
              </h3>
              <p className="text-sm text-stone-500 mt-1">Vista resumida del perfil medido en las seis evaluaciones.</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] uppercase tracking-wide font-bold text-stone-400">Índice global</div>
              <div className="text-4xl font-black text-cyan-700 tabular-nums">
                <AnimatedNumber value={overall} duration={1200} />
              </div>
            </div>
          </div>
          <div className="w-full h-[260px] lg:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                {dashboardView === 'recruiter' && (
                  <Radar name="Perfil Esperado" dataKey="idealScore" stroke="#9ca3af" strokeDasharray="4 4" strokeWidth={2} fill="#e5e7eb" fillOpacity={0.4} />
                )}
                <Radar name="Candidato" dataKey="score" stroke="#0891b2" strokeWidth={3} fill="#06b6d4" fillOpacity={0.3} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#374151' }}
                  formatter={(value) => [`${value}%`, 'Puntaje']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="text-[11px] uppercase tracking-wide font-bold text-stone-400">Lectura general</div>
              <div className="text-sm font-semibold text-stone-800 mt-1">{getSignalLabel(overall)}</div>
              <p className="text-xs text-stone-500 mt-1">Promedio agregado de la evaluación completa.</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <div className="text-[11px] uppercase tracking-wide font-bold text-stone-400">Confiabilidad</div>
              <div className="text-sm font-semibold text-stone-800 mt-1">{signalQuality.label}</div>
              <p className="text-xs text-stone-500 mt-1">Calidad de señal disponible para interpretar el resultado.</p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {effectivePersonalityProfile ? (
            <div
              className="bg-white/40 backdrop-blur-md rounded-[28px] p-6 text-stone-800 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between gap-3 relative overflow-hidden group hover:border-cyan-100 transition-colors cursor-pointer"
              onClick={() => setSelectedDeepDive('personality')}
              title="Click para ver telemetría profunda"
            >
              <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-cyan-400/20 to-sky-300/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan-600 mb-1 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Arquetipo Detectado</div>
                <h3 className="text-2xl font-black tracking-tight text-cyan-800">{effectivePersonalityProfile}</h3>
                {effectivePersonalitySubtype ? (
                  <p className="mt-1 text-sm text-stone-600 font-medium">{effectivePersonalitySubtype}</p>
                ) : null}
              </div>
              <UserCircle className="w-10 h-10 text-cyan-200 relative z-10" />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            {radarData.map((item) => {
              const band = getScoreBand(item.score);
              return (
                <div
                  key={item.subject}
                  className="bg-white/80 backdrop-blur-sm border border-stone-200 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm cursor-pointer hover:bg-stone-50 hover:border-cyan-200 hover:shadow-md transition-all group"
                  onClick={() => setSelectedDeepDive(item.gameId)}
                  title="Click para ver telemetría profunda"
                >
                  <span className="text-[11px] text-stone-500 uppercase font-bold tracking-wider mb-1 group-hover:text-cyan-700 transition-colors">{item.subject}</span>
                  <span className={`text-3xl font-black tabular-nums ${band.color}`}>
                    <AnimatedNumber value={item.score} duration={1000} />%
                  </span>
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mt-1">{band.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Card className="bg-stone-50 border-cyan-200">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-cyan-600" /> Narrativa de perfil
            </h3>
            <h4 className="text-xl font-bold text-stone-800">{profileNarrative.headline}</h4>
            <p className="text-stone-700 text-sm leading-relaxed mt-2 max-w-3xl">{profileNarrative.interpretation}</p>
          </div>

          <div className="shrink-0 rounded-xl border border-cyan-100 bg-white px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700">Lectura rápida</div>
            <div className="text-sm font-semibold text-stone-800 mt-1">{candidateSummary.title}</div>
            <p className="text-xs text-stone-500 mt-1">Mejor eje: {candidateSummary.topArea}</p>
            <p className="text-xs text-stone-500">Foco sugerido: {candidateSummary.focusArea}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5" data-testid="profile-narrative">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-2 mt-0">Fortalezas clave</div>
            <ul className="space-y-2 text-sm text-stone-600 mt-0">
              {profileNarrative.strengths.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-[11px] uppercase tracking-wide font-bold text-amber-700 mb-2 mt-0">Debilidades observadas</div>
            <ul className="space-y-2 text-sm text-stone-600 mt-0">
              {profileNarrative.weaknesses.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-[11px] uppercase tracking-wide font-bold text-stone-700 mb-2 mt-0">Plan recomendado</div>
            <ul className="space-y-2 text-sm text-stone-600 mt-0">
              {profileNarrative.actionPlan.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <button
          type="button"
          className="w-full flex items-center justify-between text-left cursor-pointer transition-all hover:bg-stone-50 rounded-lg p-2 -mx-2 -my-2"
          onClick={() => setShowPersonalityDetails((prev) => !prev)}
        >
          <h3 className="text-lg font-bold text-stone-700 flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-cyan-600" /> Test de arquetipo: lectura de respuestas
          </h3>
          <span className="text-sm text-cyan-700 font-semibold flex items-center gap-2">
            {showPersonalityDetails ? 'Ocultar detalle' : 'Ver detalle'}
            <ChevronRight className={`w-4 h-4 transition-transform ${showPersonalityDetails ? 'rotate-90' : 'rotate-0'}`} />
          </span>
        </button>

        {showPersonalityDetails ? (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {personalityData.traitRows.map((trait) => (
                <div key={trait.key} className="bg-stone-50 border border-stone-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide font-bold text-stone-500 mb-2">
                    <span>{trait.label}</span>
                    <span>{trait.value}%</span>
                  </div>
                  <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className={`h-full ${trait.color}`} style={{ width: `${clamp(trait.value, 0, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {personalityData.questionRows.map((row: any, index: number) => (
                <div key={row.id} className="border border-stone-200 rounded-lg p-3 bg-white">
                  <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-1">Pregunta {index + 1}</div>
                  <p className="text-sm font-semibold text-stone-800">{row.questionLabel}</p>
                  <p className="text-xs text-stone-500 mt-1">Mide: {row.measure}</p>
                  <p className="text-xs text-stone-600 mt-2">Respuesta elegida: {row.selectedAnswer}</p>
                  <p className="text-xs text-cyan-700 mt-1">Señal observada: {row.signal}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500 ml-2">Haz click en "Ver detalle" para abrir la lectura completa del test de arquetipo.</p>
        )}
      </Card>

      <Card data-testid={dashboardView === 'recruiter' ? 'recruiter-insights' : 'candidate-summary'}>
        <h3 className="text-lg font-bold text-stone-700 mb-3 flex items-center gap-2">
          {dashboardView === 'recruiter' ? <Briefcase className="w-5 h-5 text-cyan-600" /> : <UserCircle className="w-5 h-5 text-cyan-600" />}
          {dashboardView === 'recruiter' ? 'Insights para recruiter' : 'Resumen para candidato'}
          {dashboardView === 'recruiter' ? (
            <DashboardHint
              testId="recruiter-insights-hint"
              text="Este bloque resume señales para decisión de avance y foco de entrevista."
            />
          ) : null}
        </h3>

        {dashboardView === 'recruiter' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-full">
                Solo recruiter
              </span>
              <span className="text-[10px] uppercase tracking-wide font-bold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full">
                Lectura para decisión
              </span>
            </div>

            <ScoreLegend mode="recruiter" />

            {recruiterPack.flightRisk.hasRisk && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 animate-pulse">
                <div className="flex items-center gap-2 text-rose-700 font-bold mb-1">
                  <AlertTriangle className="w-5 h-5" /> Alerta de Riesgo de Rotación / Fuga
                </div>
                <p className="text-sm text-rose-800">{recruiterPack.flightRisk.reason}</p>
              </div>
            )}

            <div
              data-testid="signal-quality-card"
              className={`rounded-lg border p-3 ${
                signalQuality.tone === 'good'
                  ? 'bg-emerald-50 border-emerald-200'
                  : signalQuality.tone === 'warn'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide font-bold text-stone-600">Confiabilidad del informe</div>
                <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border ${toneToBadge(signalQuality.tone).style}`}>
                  {signalQuality.label} ({signalQuality.score}/100)
                </span>
              </div>
              <p className="text-sm text-stone-700 mt-1">{signalQuality.summary}</p>
              <ul className="mt-2 text-xs text-stone-600">
                {signalQuality.checks.map((line) => (
                  <li key={line} className="flex items-start gap-2 mb-1">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-cyan-600 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid="recruiter-executive-summary">
              <div className="text-[11px] uppercase tracking-wide font-bold text-stone-700 mb-2">Resumen ejecutivo (30 segundos)</div>
              <ul className="text-sm text-stone-700">
                {recruiterPack.executiveSummary.map((line) => (
                  <li key={line} className="flex items-start gap-2 mb-1.5">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div
              data-testid="recruiter-decision-card"
              className={`rounded-xl border px-4 py-3 ${
                recruiterPack.decision.tone === 'good'
                  ? 'bg-emerald-50 border-emerald-200'
                  : recruiterPack.decision.tone === 'warn'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider font-bold text-stone-500 mb-1 flex items-center gap-1.5">
                Decisión sugerida
                <DashboardHint
                  testId="recruiter-decision-hint"
                  text="Recomendación de avance basada en desempeño general, presión, comunicación y riesgo de asignación."
                />
              </div>
              <div className="text-lg font-bold text-stone-800">{recruiterPack.decision.title}</div>
              <p className="text-sm text-stone-700 mt-1">{recruiterPack.decision.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="recruiter-quickview-grid">
              {recruiterPack.quickView.map((kpi, idx) => (
                <div
                  key={kpi.label}
                  data-testid={`recruiter-kpi-${idx + 1}`}
                  title={kpi.detail}
                  className={`rounded-lg border px-3 py-2 ${
                    kpi.tone === 'good'
                      ? 'bg-emerald-50 border-emerald-100'
                      : kpi.tone === 'warn'
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-red-50 border-red-100'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide font-bold text-stone-500">{kpi.label}</div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="text-sm font-semibold text-stone-700">{kpi.value}</div>
                    <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border ${toneToBadge(kpi.tone).style}`}>
                      {toneToBadge(kpi.tone).label}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mt-1 leading-relaxed">{kpi.detail}</div>
                  <div className="text-xs text-stone-600 mt-1">Interpretación: {toneToInterpretation(kpi.tone)}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid="recruiter-strengths">
                <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-2 flex items-center gap-1.5">
                  Fortalezas
                  <DashboardHint text="Señales observadas que respaldan desempeño consistente en el rol." />
                </div>
                <ul className="text-sm text-stone-600 max-w-full">
                  {recruiterPack.strengths.map((item) => (
                    <li key={item} className="flex items-start gap-2 mb-1.5 flex-1">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid="recruiter-risks">
                <div className="text-[11px] uppercase tracking-wide font-bold text-red-600 mb-2 flex items-center gap-1.5">
                  Riesgos a validar
                  <DashboardHint text="Puntos donde se recomienda pedir evidencia adicional durante entrevista." />
                </div>
                <ul className="text-sm text-stone-600">
                  {recruiterPack.risks.map((item) => (
                    <li key={item} className="flex items-start gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid="recruiter-interview-focus">
                <div className="text-[11px] uppercase tracking-wide font-bold text-stone-700 mb-2 flex items-center gap-1.5">
                  Foco para entrevista
                  <DashboardHint text="Preguntas sugeridas para confirmar fortalezas y despejar riesgos detectados." />
                </div>
                <ul className="text-sm text-stone-600">
                  {recruiterPack.interviewFocus.map((item) => (
                    <li key={item} className="flex items-start gap-2 mb-1.5">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid="recruiter-interview-guide">
              <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-2">Guía de entrevista sugerida</div>
              <div className="space-y-2">
                {recruiterPack.interviewGuide.map((item, idx) => (
                  <div key={item.question} className="rounded-md border border-stone-200 bg-stone-50 p-2.5">
                    <div className="text-sm font-semibold text-stone-800">
                      {idx + 1}. {item.question}
                    </div>
                    <div className="text-xs text-stone-600 mt-1">
                      Señal esperada: <span className="font-medium">{item.signal}</span>
                    </div>
                  </div>
                ))}

                {/* Cross Metric Question */}
                <div className="rounded-md border-2 border-cyan-100 bg-cyan-50/50 p-3 mt-4">
                    <div className="text-[10px] uppercase tracking-wide font-bold text-cyan-700 mb-1 flex items-center gap-1.5"><Sparkles className="w-3 h-3"/> Pregunta Situacional Cruzada</div>
                    <div className="text-sm font-bold text-stone-800 italic">
                      " {recruiterPack.crossMetricQuestion} "
                    </div>
                    <div className="text-xs text-stone-600 mt-2">
                      Foco de evaluación: <span className="font-medium">Cómo gestiona su principal debilidad apoyándose en herramientas que sí domina.</span>
                    </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {candidateSummary.superpowers.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2" data-testid="candidate-superpowers">
                {candidateSummary.superpowers.map((sp) => (
                  <div key={sp.gameId} className="flex items-center gap-3 bg-gradient-to-r from-stone-800 to-stone-700 rounded-xl p-4 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-16 bg-white/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="bg-cyan-500/20 p-2 rounded-full border border-cyan-400/30">
                      <Sparkles className="w-5 h-5 text-cyan-300" />
                    </div>
                    <div className="relative z-10">
                      <div className="text-[10px] uppercase tracking-widest text-white/60 font-bold mb-0.5">Insignia de Talento</div>
                      <div className="font-bold text-lg leading-tight">{sp.badge}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border-l-4 border-l-stone-400 bg-white p-4 shadow-sm">
                <div className="text-[11px] uppercase tracking-wide font-bold text-stone-500 mb-1">Tu Cultura Laboral Ideal</div>
                <p className="text-sm font-semibold text-stone-800 italic">"{candidateSummary.cultureMatch}"</p>
              </div>

              <div className="rounded-lg border-l-4 border-l-cyan-500 bg-white p-4 shadow-sm">
                <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-600 mb-1">Tu Zona de Flujo Operativo</div>
                <p className="text-sm font-semibold text-stone-800 italic">"{candidateSummary.flowZone}"</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-2">Lo que hiciste bien</div>
                <ul className="text-sm text-stone-600">
                  {candidateSummary.strengths.map((item) => (
                    <li key={item} className="flex items-start gap-2 mb-1.5">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-amber-700 mb-2">Para mejorar</div>
                <ul className="text-sm text-stone-600">
                  {candidateSummary.developmentAreas.map((item) => (
                    <li key={item} className="flex items-start gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-stone-700 mb-2">Próximos pasos</div>
                <ul className="text-sm text-stone-600">
                  {candidateSummary.nextSteps.map((item) => (
                    <li key={item} className="flex items-start gap-2 mb-1.5">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Card>

      {dashboardView === 'recruiter' && (
        <div className="print:hidden mt-8">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Activity className="w-4 h-4 text-cyan-600" />
            <h3 className="text-sm uppercase tracking-widest font-bold text-stone-500">Timeline de Fatiga / Resistencia</h3>
          </div>
          <Card className="p-4 bg-white/50 backdrop-blur-sm border-stone-200">
            <div className="w-full h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={5} />
                  <YAxis domain={['dataMin - 10', 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`${value}%`, 'Score']}
                    labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#0891b2"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 6, fill: '#0891b2', stroke: '#cffafe', strokeWidth: 3 }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-stone-500 mt-2 text-center italic">Grafica temporal del desempeño a lo largo de la prueba general ponderando resiliencia a la fatiga.</p>
          </Card>
        </div>
      )}

    </div>
  );
};
