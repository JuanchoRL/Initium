import { type LucideIcon, UserCircle, Brain, Users, MessageSquare, ShieldAlert, Zap, Disc, Target } from 'lucide-react';
import type { GameId, Stage, TransitionMap, ScoresMap, MetricsMap } from './types';

export const STORAGE_KEY = 'initium_assessment_resume_v2';
export const TUTORIALS_STORAGE_KEY = 'initium_seen_tutorials_v1';

export const STAGE_TRANSITIONS: TransitionMap<Stage> = {
  login: ['consent', 'playing'],
  consent: ['login', 'welcome'],
  welcome: ['login', 'contextIntro', 'instructions'],
  contextIntro: ['playing', 'login'],
  instructions: ['playing', 'login'],
  betweenGames: ['instructions', 'login'],
  playing: ['betweenGames', 'results', 'login', 'instructions'],
  results: ['login'],
};

export const GAME_DEFS: Array<{
  id: GameId;
  title: string;
  objective: string;
  icon: LucideIcon;
  recruiterSignal: string;
  candidateTip: string;
  estSec: number;
}> = [
  {
    id: 'personality',
    title: 'Test de Arquetipo',
    objective: 'Rasgos de colaboración, estilo y cultura de trabajo.',
    icon: UserCircle,
    recruiterSignal: 'Preferencias de decisión, relación interpersonal y estilo de colaboración.',
    candidateTip: 'Responde de forma auténtica. No hay opción correcta.',
    estSec: 80,
  },
  {
    id: 'memory',
    title: 'Reconstrucción Espacial',
    objective: 'Memorizar un diseño y reconstruirlo con piezas.',
    icon: Brain,
    recruiterSignal: 'Memoria de trabajo visual, planificación y precisión bajo tiempo.',
    candidateTip: 'Recuerda la estructura completa y valida antes de confirmar.',
    estSec: 50,
  },
  {
    id: 'leadership',
    title: 'Gestión de Recursos',
    objective: 'Asignar tareas con capacidad y fit de rol.',
    icon: Users,
    recruiterSignal: 'Priorización, balance de carga y criterio operativo.',
    candidateTip: 'Busca match de rol y evita sobrecarga del equipo.',
    estSec: 90,
  },
  {
    id: 'problemSolving',
    title: 'Resolución de Crisis',
    objective: 'Respuesta escrita ante conflicto real.',
    icon: MessageSquare,
    recruiterSignal: 'Empatía, estructura, claridad y ejecución.',
    candidateTip: 'Reconoce impacto, comunica plan y define siguiente paso.',
    estSec: 110,
  },
  {
    id: 'ethics',
    title: 'Inspector de Auditoría',
    objective: 'Resolver un dilema ético en un sistema operativo simulado bajo presión.',
    icon: ShieldAlert,
    recruiterSignal: 'Integridad, criterio ético, consistencia moral y respuesta ante presión jerárquica.',
    candidateTip: 'Busca hechos, entiende el conflicto y decide con criterio antes de que venza el tiempo.',
    estSec: 125,
  },
  {
    id: 'risk',
    title: 'Tolerancia al Riesgo',
    objective: 'Control de impulso con umbral incierto.',
    icon: Zap,
    recruiterSignal: 'Autocontrol, timing y gestión de incertidumbre.',
    candidateTip: 'No busques máximo absoluto, busca consistencia.',
    estSec: 70,
  },
  {
    id: 'network',
    title: 'Red de Enrutamiento',
    objective: 'Guiar trenes de color a su nodo correcto bajo presión.',
    icon: Disc,
    recruiterSignal: 'Atención dividida, planificación y velocidad de procesamiento.',
    candidateTip: 'Anticipa bifurcaciones y evita cambios de último segundo.',
    estSec: 75,
  },
  {
    id: 'strategy',
    title: 'Matriz Estratégica',
    objective: 'Trade-offs de inversión bajo restricciones.',
    icon: Target,
    recruiterSignal: 'Visión, foco y consistencia de prioridades.',
    candidateTip: 'Distribuye con criterio y evita decisiones extremas.',
    estSec: 80,
  },
];

export const EMPTY_SCORES: ScoresMap = {
  personality: 0,
  memory: 0,
  leadership: 0,
  problemSolving: 0,
  ethics: 0,
  risk: 0,
  network: 0,
  strategy: 0,
};

export const EMPTY_METRICS: MetricsMap = {
  personality: {},
  memory: {},
  leadership: {},
  problemSolving: {},
  ethics: {},
  risk: {},
  network: {},
  strategy: {},
};

export const DEBUG_RESULTS_FIXTURE = {
  scores: {
    personality: 100,
    memory: 78,
    leadership: 74,
    problemSolving: 71,
    ethics: 83,
    risk: 69,
    network: 76,
    strategy: 72,
  },
  metrics: {
    personality: {
      disc_d_pct: 34,
      disc_i_pct: 21,
      disc_s_pct: 22,
      disc_c_pct: 23,
      q1_choice: 'A',
      q1_signal: 'Iniciativa y direccion',
      q2_choice: 'D',
      q2_signal: 'Precision y control',
      q3_choice: 'A',
      q3_signal: 'Comunicacion directa',
      q4_choice: 'D',
      q4_signal: 'Análisis',
      q5_choice: 'B',
      q5_signal: 'Evaluacion de riesgo',
      q6_choice: 'A',
      q6_signal: 'Resolucion',
      q7_choice: 'C',
      q7_signal: 'Realismo operativo',
    },
    memory: {
      correct_patterns: 4,
      total_rounds: 5,
      avg_reconstruction_time_sec: 11.4,
    },
    leadership: {
      role_match_rate: 0.71,
      mismatch_count: 2,
      technical_mismatch_count: 1,
      overload_warnings: 1,
    },
    problemSolving: {
      empathy: 73,
      structure: 70,
      decisiveness: 69,
    },
    ethics: {
      ending_id: 'middle',
      promise_choice: 'rules',
      case1_decision: 'deny',
      case2_decision: 'deny',
      ethical_integrity: 94,
      human_empathy: 68,
      authority_alignment: 58,
      decision_consistency: 92,
      pressure_control: 84,
      confidential_opened: true,
    },
    risk: {
      explosions: 2,
      release_ratio: 0.74,
    },
    network: {
      accuracy: 0.77,
      correct_routes: 16,
      wrong_routes: 5,
    },
    strategy: {
      dominant_focus: 'data',
      diversity_index: 0.82,
    },
  },
  strategyProfile: 'data',
  personalityProfile: 'Analista Critico',
  completedGameDurationsSec: {
    personality: 92,
    memory: 64,
    leadership: 114,
    problemSolving: 95,
    ethics: 126,
    risk: 70,
    network: 68,
    strategy: 74,
  },
};

export const PERFORMANCE_GAME_IDS: GameId[] = ['memory', 'leadership', 'problemSolving', 'ethics', 'risk', 'network', 'strategy'];
