'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Award,
  BatteryWarning,
  Brain,
  Briefcase,
  Clipboard,
  CheckCircle2,
  ChevronRight,
  Compass,
  Cpu,
  Database,
  Disc,
  Fingerprint,
  Info,
  Lightbulb,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  MousePointerClick,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  UserCircle,
  Users,
  Zap,
} from 'lucide-react';
import GameLeadershipV2 from './games/leadership-v2/GameLeadershipV2';
import { buildAssessmentSummary } from '@/lib/admin-dashboard/storage';
import { startRecruiterAccess } from '@/lib/admin-dashboard/api';
import { clearRecruiterAccessSession, writeRecruiterAccessSession } from '@/lib/admin-dashboard/recruiter-session';
import { persistAssessmentResult } from '@/lib/assessment-results/api';

type GameId = 'personality' | 'memory' | 'leadership' | 'problemSolving' | 'risk' | 'network' | 'strategy';
type Stage = 'login' | 'consent' | 'welcome' | 'contextIntro' | 'instructions' | 'betweenGames' | 'playing' | 'results';
type AccessType = 'candidate' | 'recruiter';
type TransitionMap<T extends string> = Record<T, readonly T[]>;

const canTransition = <T extends string>(current: T, next: T, map: TransitionMap<T>) => {
  if (current === next) return true;
  return map[current]?.includes(next) ?? false;
};

const useStateMachine = <T extends string>(initial: T, transitions: TransitionMap<T>, label: string) => {
  const [state, setState] = useState<T>(initial);
  const transition = useCallback(
    (next: T, options?: { force?: boolean }) => {
      setState((current) => {
        if (options?.force || canTransition(current, next, transitions)) return next;
        console.warn(`[${label}] invalid transition`, { from: current, to: next });
        return current;
      });
    },
    [label, transitions]
  );
  return [state, transition] as const;
};

type CandidateProfile = {
  name: string;
  email: string;
  role: string;
  accessType: AccessType;
  acceptedTerms: boolean;
  acceptedDataPolicy: boolean;
};

type GameMetrics = Record<string, number | string | boolean>;
type GameResult = { score: number; metrics: GameMetrics };
type ScoresMap = Record<GameId, number>;
type MetricsMap = Record<GameId, GameMetrics>;

type TelemetryEvent = {
  event: string;
  ts: number;
  gameId?: GameId;
  payload?: Record<string, unknown>;
};

type ResumeSnapshot = {
  stage: Stage;
  currentGameIndex: number;
  candidate: CandidateProfile;
  scores: ScoresMap;
  metrics: MetricsMap;
  strategyProfile: string;
  personalityProfile: string;
  completedGameDurationsSec?: Partial<Record<GameId, number>>;
  createdAt: number;
};

type SeenTutorialMap = Partial<Record<GameId, boolean>>;

type AllocationKey = 'ops' | 'staff' | 'data' | 'rd';
type AllocationMap = Record<AllocationKey, number>;

const STORAGE_KEY = 'initium_assessment_resume_v2';
const TUTORIALS_STORAGE_KEY = 'initium_seen_tutorials_v1';
const STAGE_TRANSITIONS: TransitionMap<Stage> = {
  login: ['consent', 'playing'],
  consent: ['login', 'welcome'],
  welcome: ['login', 'contextIntro', 'instructions'],
  contextIntro: ['playing', 'login'],
  instructions: ['playing', 'login'],
  betweenGames: ['instructions', 'login'],
  playing: ['betweenGames', 'results', 'login', 'instructions'],
  results: ['login'],
};

const GAME_DEFS: Array<{
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

const EMPTY_SCORES: ScoresMap = {
  personality: 0,
  memory: 0,
  leadership: 0,
  problemSolving: 0,
  risk: 0,
  network: 0,
  strategy: 0,
};

const EMPTY_METRICS: MetricsMap = {
  personality: {},
  memory: {},
  leadership: {},
  problemSolving: {},
  risk: {},
  network: {},
  strategy: {},
};

const DEBUG_RESULTS_FIXTURE: {
  scores: ScoresMap;
  metrics: MetricsMap;
  strategyProfile: string;
  personalityProfile: string;
  completedGameDurationsSec: Partial<Record<GameId, number>>;
} = {
  scores: {
    personality: 100,
    memory: 78,
    leadership: 74,
    problemSolving: 71,
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
    risk: 70,
    network: 68,
    strategy: 74,
  },
};

const buildDebugCandidate = (accessType: AccessType): CandidateProfile => ({
  name: accessType === 'recruiter' ? 'Recruiter QA' : 'Candidato QA',
  email: accessType === 'recruiter' ? 'recruiter.qa@initium.local' : 'candidate.qa@initium.local',
  role: accessType === 'recruiter' ? 'Talent Acquisition' : 'Operations Analyst',
  accessType,
  acceptedTerms: true,
  acceptedDataPolicy: true,
});

const PERFORMANCE_GAME_IDS: GameId[] = ['memory', 'leadership', 'problemSolving', 'risk', 'network', 'strategy'];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const avg = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const m = avg(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const entropy = (probabilities: number[]) => {
  return probabilities.reduce((acc, p) => {
    if (p <= 0) return acc;
    return acc - p * Math.log2(p);
  }, 0);
};

const toSafeNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return 'masked';
  if (name.length <= 2) return `${name[0] ?? '*'}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

function useStableSessionId() {
  const idRef = useRef<string>('');
  if (!idRef.current) {
    idRef.current = createSessionId();
  }
  return idRef.current;
}

function useTelemetry(sessionId: string, candidate: CandidateProfile | null) {
  const queueRef = useRef<TelemetryEvent[]>([]);

  const flush = useCallback(async () => {
    if (!queueRef.current.length) return;
    const events = queueRef.current.splice(0, queueRef.current.length);
    const body = {
      sessionId,
      candidate: candidate
        ? {
            role: candidate.role,
            emailMasked: maskEmail(candidate.email),
          }
        : null,
      events,
    };

    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      queueRef.current.unshift(...events);
    }
  }, [candidate, sessionId]);

  const track = useCallback(
    (event: string, payload?: Record<string, unknown>, gameId?: GameId) => {
      queueRef.current.push({
        event,
        ts: Date.now(),
        gameId,
        payload,
      });
    },
    []
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void flush();
    }, 4000);

    const onUnload = () => {
      if (!queueRef.current.length) return;
      const events = queueRef.current.splice(0, queueRef.current.length);
      const payload = {
        sessionId,
        candidate: candidate
          ? {
              role: candidate.role,
              emailMasked: maskEmail(candidate.email),
            }
          : null,
        events,
      };

      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/events', blob);
      }
    };

    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', onUnload);
      void flush();
    };
  }, [flush, candidate, sessionId]);

  return {
    track,
    flush,
  };
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ai';
};

const Card = ({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string }) => (
  <div
    {...rest}
    className={`bg-white border border-stone-200 rounded-xl p-6 shadow-xl shadow-stone-200/50 ${className}`}
  >
    {children}
  </div>
);

const Button = ({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) => {
  const baseStyle =
    'px-6 py-3 rounded-lg font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20',
    secondary: 'bg-stone-200 hover:bg-stone-300 text-stone-700',
    danger: 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20',
    outline: 'border-2 border-cyan-600 text-cyan-700 hover:bg-cyan-50',
    ai: 'bg-stone-800 hover:bg-stone-700 text-white shadow-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

const InputField = ({
  value,
  onChange,
  type = 'text',
  placeholder,
  icon: Icon,
}: {
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder: string;
  icon?: LucideIcon;
}) => (
  <div className="relative">
    {Icon ? (
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
        <Icon className="w-5 h-5" />
      </div>
    ) : null}
    <input
      type={type}
      className="w-full bg-stone-50 border border-stone-200 rounded-lg py-3.5 pl-10 pr-4 text-stone-800 placeholder-stone-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all outline-none text-base"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

const ToggleRow = ({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
  icon: LucideIcon;
}) => (
  <label className="flex items-start gap-3 p-4 bg-stone-50 border border-stone-200 rounded-lg cursor-pointer">
    <input
      type="checkbox"
      className="mt-1 h-4 w-4 accent-cyan-600"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    <Icon className="w-5 h-5 text-cyan-600 mt-0.5" />
    <div>
      <div className="font-semibold text-stone-700 text-sm">{title}</div>
      <div className="text-xs text-stone-500 leading-relaxed">{description}</div>
    </div>
  </label>
);

const ProgressBar = ({
  currentStep,
  onSave,
  remainingSecOverride,
}: {
  currentStep: number;
  onSave: () => void;
  remainingSecOverride?: number;
}) => {
  const completion = ((currentStep + 1) / GAME_DEFS.length) * 100;
  const remainingSec =
    remainingSecOverride ?? GAME_DEFS.slice(currentStep + 1).reduce((acc, game) => acc + game.estSec, 0);
  const remainingMin = Math.ceil(remainingSec / 60);

  return (
    <div className="w-full bg-white border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex justify-between items-center mb-2 gap-4">
          <div>
            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Progreso de Evaluación</span>
            <div className="text-xs text-stone-400 mt-1">Tiempo restante estimado: {remainingMin} min</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-cyan-600">
              {currentStep + 1} / {GAME_DEFS.length}
            </span>
            <Button variant="secondary" className="py-2 px-3 text-xs" onClick={onSave}>
              <Save className="w-3.5 h-3.5" /> Guardar
            </Button>
          </div>
        </div>
        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-500 transition-all duration-500 ease-out" style={{ width: `${completion}%` }} />
        </div>
      </div>
    </div>
  );
};

const LoginScreen = ({
  onSubmit,
  onResume,
  canResume,
}: {
  onSubmit: (data: Omit<CandidateProfile, 'acceptedTerms' | 'acceptedDataPolicy'>) => void;
  onResume: () => void;
  canResume: boolean;
}) => {
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: string;
    accessType: AccessType;
  }>({ name: '', email: '', role: '', accessType: 'candidate' });
  const emailValid = /\S+@\S+\.\S+/.test(formData.email);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" data-testid="login-screen">
      <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-12 items-center animate-fade-in">
        <div className="space-y-6 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
            <Brain className="w-12 h-12 text-cyan-600" />
            <h1 className="text-5xl font-bold text-stone-800 tracking-tight">
              Initium<span className="text-cyan-600">+</span>
            </h1>
          </div>
          <h2 className="text-3xl font-bold text-stone-700 leading-tight">Evaluación de talento basada en datos</h2>
          <p className="text-lg text-stone-500 leading-relaxed font-light">
            Reemplazamos tests tradicionales por datos conductuales y análisis de patrones para decisiones más objetivas.
          </p>

          {canResume && formData.accessType === 'candidate' ? (
            <Card className="text-left p-4 border-cyan-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-700 text-sm">Sesión previa detectada</div>
                  <div className="text-xs text-stone-500">Puedes continuar donde quedaste.</div>
                </div>
                <Button variant="outline" className="py-2 px-3 text-xs" onClick={onResume}>
                  Continuar
                </Button>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-2xl shadow-stone-200/50 border border-stone-100">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!formData.name || !emailValid) return;
              onSubmit(formData);
            }}
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-stone-700">Acceso a plataforma</h3>
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Ingresar como</p>
              <div className="grid grid-cols-2 gap-2 bg-stone-100 rounded-lg p-1 border border-stone-200">
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    formData.accessType === 'candidate'
                      ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                      : 'text-stone-600 hover:bg-white/70'
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, accessType: 'candidate' }))}
                >
                  Candidato
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    formData.accessType === 'recruiter'
                      ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                      : 'text-stone-600 hover:bg-white/70'
                  }`}
                  onClick={() => setFormData((prev) => ({ ...prev, accessType: 'recruiter' }))}
                >
                  Recruiter
                </button>
              </div>
            </div>

            <InputField
              placeholder="Nombre completo"
              value={formData.name}
              onChange={(name) => setFormData((prev) => ({ ...prev, name }))}
              icon={UserCircle}
            />
            <InputField
              placeholder="Correo electrónico"
              type="email"
              value={formData.email}
              onChange={(email) => setFormData((prev) => ({ ...prev, email }))}
              icon={Mail}
            />
            <InputField
              placeholder={formData.accessType === 'recruiter' ? 'Área o posición a cubrir' : 'Rol o puesto objetivo'}
              value={formData.role}
              onChange={(role) => setFormData((prev) => ({ ...prev, role }))}
              icon={Briefcase}
            />

            {!emailValid && formData.email ? <p className="text-xs text-red-500">Ingresa un correo válido.</p> : null}

            <Button
              type="submit"
              variant="primary"
              className="w-full text-lg py-4 mt-2"
              disabled={!formData.name || !emailValid}
            >
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

const ConsentScreen = ({
  candidate,
  onBack,
  onConfirm,
}: {
  candidate: CandidateProfile;
  onBack: () => void;
  onConfirm: (next: CandidateProfile) => void;
}) => {
  const [acceptedTerms, setAcceptedTerms] = useState(candidate.acceptedTerms);
  const [acceptedDataPolicy, setAcceptedDataPolicy] = useState(candidate.acceptedDataPolicy);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-2xl w-full space-y-6">
        <Card className="border-l-4 border-l-cyan-500">
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Consentimiento informado</h2>
          <p className="text-stone-600 text-sm leading-relaxed mb-5">
            Esta evaluación registra eventos de interacción (tiempos, decisiones, correcciones) para construir insights de recruiting.
            No usamos tus datos para publicidad. Puedes solicitar eliminación de datos.
          </p>

          <div className="space-y-3">
            <ToggleRow
              checked={acceptedTerms}
              onChange={setAcceptedTerms}
              title="Acepto términos de evaluación"
              description="Autorizo el uso de resultados para proceso de selección en este rol."
              icon={CheckCircle2}
            />
            <ToggleRow
              checked={acceptedDataPolicy}
              onChange={setAcceptedDataPolicy}
              title="Acepto captura de datos conductuales"
              description="Incluye tiempo de respuesta, patrones de decisión y errores operativos."
              icon={Database}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <Button variant="secondary" onClick={onBack}>
              Volver
            </Button>
            <Button
              onClick={() =>
                onConfirm({
                  ...candidate,
                  acceptedTerms,
                  acceptedDataPolicy,
                })
              }
              disabled={!acceptedTerms || !acceptedDataPolicy}
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-4 bg-stone-50 border-stone-200">
          <div className="grid md:grid-cols-3 gap-3 text-xs text-stone-500">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-cyan-600 mt-0.5" /> Datos minimizados
            </div>
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-600 mt-0.5" /> Evaluación transparente
            </div>
            <div className="flex items-start gap-2">
              <Compass className="w-4 h-4 text-cyan-600 mt-0.5" /> Feedback constructivo
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

const WelcomeScreen = ({
  candidate,
  onStart,
}: {
  candidate: CandidateProfile;
  onStart: () => void;
}) => {
  const totalMinutes = Math.ceil(GAME_DEFS.reduce((sum, game) => sum + game.estSec, 0) / 60);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-stone-100 mb-4 animate-pulse">
          <Fingerprint className="w-12 h-12 text-cyan-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-stone-800">
            Te damos la bienvenida, <span className="text-cyan-600">{candidate.name.split(' ')[0]}</span>
          </h1>
          <p className="text-lg text-stone-500">
            Iniciarás {GAME_DEFS.length} simulaciones cortas. Duración total estimada: {totalMinutes} minutos.
          </p>
        </div>

        <Card className="bg-stone-50 border-stone-200 text-left p-5 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <p className="text-stone-600 text-sm">No hay respuestas perfectas: evaluamos estilo de decisión y consistencia.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <p className="text-stone-600 text-sm">Tendrás feedback claro para candidato y evidencia accionable para recruiter.</p>
          </div>
          <div className="flex items-start gap-3">
            <BatteryWarning className="w-5 h-5 text-amber-500 mt-0.5" />
            <p className="text-stone-600 text-sm">Si necesitas pausar, usa el botón Guardar en la barra superior.</p>
          </div>
        </Card>

        <Button onClick={onStart} className="w-full py-4 text-lg">
          Comenzar evaluación <Play className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const ContextIntroScreen = ({ onComplete }: { onComplete: () => void }) => {
  const slides = useMemo(
    () => [
      {
        text:
          'Bienvenido a Initium+. Transformamos el análisis de datos y tendencias en una comprensión profunda de cada candidato.',
        durationMs: 10000,
      },
      {
        text:
          'Nuestra tecnología en tiempo real permite descifrar el potencial humano para conectar el mejor talento con las mejores oportunidades.',
        durationMs: 10000,
      },
      {
        text:
          'A continuación, te enfrentarás a una serie de desafíos: desde preguntas para conocerte mejor hasta dinámicas de juego que nos permitirán identificar tu potencial.',
        durationMs: 10000,
      },
      {
        text: 'Relájate y disfruta la experiencia.',
        durationMs: 5000,
      },
    ],
    []
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const current = slides[currentIndex];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (currentIndex < slides.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onComplete();
      }
    }, current.durationMs);
    return () => clearTimeout(timer);
  }, [currentIndex, current.durationMs, onComplete, slides.length]);

  return (
    <div className="min-h-[calc(100vh-96px)] flex flex-col items-center justify-center px-6 py-8 text-center animate-fade-in relative bg-stone-50">
      <div className="w-full max-w-[21rem] sm:max-w-[30rem] md:max-w-[38rem] lg:max-w-[46rem] flex flex-col items-center justify-center gap-8">
        <div className="w-16 h-16 rounded-full bg-cyan-50 border border-cyan-100 shadow-inner flex items-center justify-center animate-pulse">
          <div className="relative w-6 h-6" aria-hidden>
            <span className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-cyan-500/90" />
            <span className="absolute top-1/2 left-0 w-full h-[3px] -translate-y-1/2 rounded-full bg-cyan-500/90" />
            <span className="absolute left-1/2 top-1/2 w-[2px] h-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300" />
          </div>
        </div>

        <h2
          key={currentIndex}
          className="text-[1.95rem] sm:text-[2.2rem] md:text-[2.55rem] lg:text-[2.85rem] font-light text-stone-800 leading-[1.17] tracking-[-0.01em] animate-fade-in"
        >
          {current.text}
        </h2>

        <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-7 max-w-sm mx-auto relative">
          <div
            key={currentIndex}
            className="h-full bg-cyan-500 absolute left-0 top-0"
            style={{
              width: '100%',
              animation: `introFill ${current.durationMs}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes introFill {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

const BETWEEN_GAME_LINES = [
  'Perfecto, avancemos al siguiente juego.',
  'Reto completado. Avanzando a la siguiente evaluación.',
  'Muy bien. Continuemos con el siguiente reto.',
  'Buen ritmo. Vamos con la siguiente simulación.',
  'Excelente avance. Entramos al próximo desafío.',
  'Último tramo: una evaluación más y cerramos.',
];

const BetweenGamesTransitionScreen = ({
  fromTitle,
  toTitle,
  line,
  onComplete,
}: {
  fromTitle: string;
  toTitle: string;
  line: string;
  onComplete: () => void;
}) => {
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, 10000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    const unlockTimer = window.setTimeout(() => setCanSkip(true), 1800);
    return () => clearTimeout(unlockTimer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canSkip) return;
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        onComplete();
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canSkip, onComplete]);

  return (
    <div className="min-h-[calc(100vh-96px)] flex flex-col items-center justify-center px-6 py-8 text-center animate-fade-in relative bg-stone-50">
      <div className="w-full max-w-[21rem] sm:max-w-[30rem] md:max-w-[38rem] lg:max-w-[46rem] flex flex-col items-center justify-center gap-7">
        <div className="w-16 h-16 rounded-full bg-cyan-50 border border-cyan-100 shadow-inner flex items-center justify-center animate-pulse">
          <div className="relative w-7 h-7" aria-hidden>
            <span className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-cyan-500/90" />
            <span className="absolute top-1/2 left-0 w-full h-[3px] -translate-y-1/2 rounded-full bg-cyan-500/90" />
            <span className="absolute left-1/2 top-1/2 w-[2px] h-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-[1.9rem] sm:text-[2.15rem] md:text-[2.45rem] lg:text-[2.7rem] font-light text-stone-800 leading-[1.18] tracking-[-0.01em]">
            {line}
          </h2>
        </div>

        <div className="w-full max-w-xl bg-white/70 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-600">
          <span className="font-semibold text-stone-700">{fromTitle}</span>
          <span className="mx-2 text-stone-400">{'>'}</span>
          <span className="font-semibold text-cyan-700">{toTitle}</span>
        </div>

        <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-2 max-w-sm mx-auto relative">
          <div
            className="h-full bg-cyan-500 absolute left-0 top-0"
            style={{
              width: '100%',
              animation: 'betweenGamesFill 10000ms linear forwards',
            }}
          />
        </div>

        <button
          onClick={onComplete}
          disabled={!canSkip}
          className={`text-xs font-semibold tracking-wide transition-colors ${
            canSkip ? 'text-cyan-700 hover:text-cyan-800' : 'text-stone-400 cursor-not-allowed'
          }`}
        >
          {canSkip ? 'Continuar ahora' : 'Preparando siguiente juego...'}
        </button>
      </div>

      <style jsx>{`
        @keyframes betweenGamesFill {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

const MiniTutorialRisk = () => {
  return (
    <div className="bg-stone-100 p-4 rounded-xl border border-stone-200 mt-4">
      <h4 className="font-bold text-stone-700 mb-3 flex items-center gap-2 text-sm">
        <MousePointerClick className="w-4 h-4 text-cyan-600" /> Ejemplo rápido
      </h4>
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-full h-4 bg-stone-300 rounded-full overflow-hidden">
          <div className="absolute top-0 left-0 h-full bg-cyan-500 animate-[fillBar_2s_infinite_ease-out] w-3/4" />
          <div className="absolute top-0 right-[20%] w-[1px] h-full bg-red-500/50 z-10" />
        </div>
        <div className="flex justify-between w-full text-[10px] text-stone-500 font-mono uppercase">
          <span>0%</span>
          <span>Mantener</span>
          <span className="text-red-500 font-bold">Soltar antes del límite</span>
        </div>
      </div>
    </div>
  );
};

const controlHintByGame: Record<GameId, string> = {
  personality: 'Elige la opción que mejor te represente; priorizamos autenticidad.',
  memory: 'Memoriza la forma final y luego reconstrúyela arrastrando piezas.',
  leadership: 'Selecciona una tarea y asígnala a quien tenga mejor fit y carga.',
  problemSolving: 'Escribe respuesta breve con empatía + plan accionable.',
  risk: 'Mantener y soltar: máximo puntaje sin explotar.',
  network: 'Pulsa interruptores en bifurcaciones antes de que llegue cada tren.',
  strategy: 'Distribuye 100% del capital entre 4 prioridades.',
};

const tutorialStepsByGame: Record<GameId, string[]> = {
  personality: [
    'Lee la pregunta y elige una sola opción.',
    'Responde según cómo actúas en la vida real, no cómo “debería ser”.',
    'Repite hasta completar todas las preguntas.',
  ],
  memory: [
    'Primero mira la figura y memoriza la forma completa.',
    'Después arrastra las piezas al tablero para copiar la figura.',
    'Rota piezas si hace falta y presiona “Verificar estructura”.',
  ],
  leadership: [
    'Elige una tarea pendiente.',
    'Después elige a la persona del equipo que mejor pueda resolverla.',
    'Revisa la carga general y confirma cuando todo esté asignado.',
  ],
  problemSolving: [
    'Lee el escenario con calma.',
    'Escribe qué dirías y qué harías en orden, paso por paso.',
    'Incluye impacto humano, acción inmediata y seguimiento.',
  ],
  risk: [
    'Mantén presionado para cargar el medidor.',
    'Suelta antes del límite invisible para no fallar.',
    'Si sueltas dentro del arco marcado, ganas bonus de puntos.',
  ],
  network: [
    'Observa qué color viene por la vía.',
    'Haz clic en los interruptores antes de que llegue al cruce.',
    'Guía cada color a su estación del mismo color.',
  ],
  strategy: [
    'Debes repartir exactamente 100% entre cuatro áreas.',
    'Cada cambio afecta el equilibrio general.',
    'Cuando no quede capital, confirma tu estrategia.',
  ],
};

const InstructionsScreen = ({
  gameIndex,
  onStart,
}: {
  gameIndex: number;
  onStart: () => void;
}) => {
  const info = GAME_DEFS[gameIndex];

  return (
    <div className="max-w-3xl w-full mx-auto pt-10 px-4 animate-fade-in">
      <Card className="border-l-4 border-l-cyan-500">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="flex items-center justify-center w-20 h-20 rounded-xl bg-stone-100 border border-stone-200 shrink-0">
            {React.createElement(info.icon, { className: 'w-10 h-10 text-stone-600' })}
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <div className="text-xs font-bold text-cyan-600 tracking-wider uppercase mb-1">Fase {gameIndex + 1}</div>
              <h2 className="text-3xl font-bold text-stone-800 mb-2">{info.title}</h2>
              <p className="text-stone-600 text-lg">{info.objective}</p>
            </div>

            <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
              <div className="text-[11px] uppercase tracking-wider font-bold text-cyan-600 mb-1">Tip para candidato</div>
              <p className="text-sm text-stone-600">{info.candidateTip}</p>
            </div>

            <div className="bg-cyan-50 p-3 rounded-lg border border-cyan-100 flex gap-3">
              <Info className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
              <p className="text-sm text-cyan-800">Control: {controlHintByGame[info.id]}</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-stone-200">
              <div className="text-[11px] uppercase tracking-wider font-bold text-cyan-600 mb-2">
                Cómo se juega (paso a paso)
              </div>
              <ol className="space-y-2">
                {tutorialStepsByGame[info.id].map((step, index) => (
                  <li key={`${info.id}-step-${index}`} className="flex items-start gap-2 text-sm text-stone-700">
                    <span className="mt-[1px] inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {info.id === 'risk' ? <MiniTutorialRisk /> : null}

            <div className="pt-3 flex justify-end">
              <Button onClick={onStart} className="w-full md:w-auto">
                Iniciar fase <Play className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

type GameProps = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
};

type PersonalityOptionId = 'A' | 'B' | 'C' | 'D';
type PersonalityTraitId = 'D' | 'I' | 'S' | 'C';

type PersonalityQuestionOption = {
  id: PersonalityOptionId;
  text: string;
  trait: PersonalityTraitId;
  signal: string;
};

type PersonalityQuestion = {
  id: string;
  title: string;
  measure: string;
  options: PersonalityQuestionOption[];
};

const personalityTraitMeta: Record<PersonalityTraitId, { label: string; name: string }> = {
  D: { label: 'Líder Visionario', name: 'Dominante' },
  I: { label: 'Conector Social', name: 'Influyente' },
  S: { label: 'Soporte Estable', name: 'Estable' },
  C: { label: 'Analista Crítico', name: 'Concienzudo' },
};

const PERSONALITY_QUESTIONS: PersonalityQuestion[] = [
  {
    id: 'q1',
    title: 'En un grupo nuevo, ¿qué rol prefieres?',
    measure: 'Iniciativa de rol y forma de participar en equipos nuevos.',
    options: [
      { id: 'A', text: 'El que propone la idea.', trait: 'D', signal: 'Iniciativa y dirección' },
      { id: 'B', text: 'El que organiza el plan.', trait: 'C', signal: 'Planificación y estructura' },
      { id: 'C', text: 'El que une a la gente.', trait: 'I', signal: 'Cohesión y vínculo social' },
      { id: 'D', text: 'El que revisa errores.', trait: 'C', signal: 'Control de calidad' },
    ],
  },
  {
    id: 'q2',
    title: 'Si fueras un animal en el trabajo, serías...',
    measure: 'Estilo conductual base bajo un marco DISC.',
    options: [
      { id: 'A', text: 'León.', trait: 'D', signal: 'Dominancia' },
      { id: 'B', text: 'Nutria.', trait: 'I', signal: 'Influencia' },
      { id: 'C', text: 'Golden Retriever.', trait: 'S', signal: 'Estabilidad' },
      { id: 'D', text: 'Castor.', trait: 'C', signal: 'Conciencia y detalle' },
    ],
  },
  {
    id: 'q3',
    title: '¿Cómo prefieres recibir feedback?',
    measure: 'Preferencia de comunicación y recepción de feedback.',
    options: [
      { id: 'A', text: 'Directo y al grano.', trait: 'D', signal: 'Franqueza directa' },
      { id: 'B', text: 'Con ejemplos positivos primero.', trait: 'I', signal: 'Motivación social' },
      { id: 'C', text: 'En una charla privada y tranquila.', trait: 'S', signal: 'Seguridad emocional' },
    ],
  },
  {
    id: 'q4',
    title: 'Elige un "superpoder" laboral:',
    measure: 'Driver de valor en el trabajo (visión, empatía, productividad o análisis).',
    options: [
      { id: 'A', text: 'Viajar al futuro.', trait: 'D', signal: 'Visión estratégica' },
      { id: 'B', text: 'Leer mentes.', trait: 'S', signal: 'Empatía interpersonal' },
      { id: 'C', text: 'Clonarse.', trait: 'C', signal: 'Productividad y foco' },
      { id: 'D', text: 'Invisibilidad.', trait: 'C', signal: 'Análisis profundo' },
    ],
  },
  {
    id: 'q5',
    title: 'Ante un cambio imprevisto, tú...',
    measure: 'Respuesta frente a incertidumbre y gestión del cambio.',
    options: [
      { id: 'A', text: 'Te entusiasmas por el reto.', trait: 'D', signal: 'Apertura al reto' },
      { id: 'B', text: 'Te detienes a evaluar riesgos.', trait: 'C', signal: 'Gestión de riesgo' },
      { id: 'C', text: 'Buscas cómo afecta al equipo.', trait: 'S', signal: 'Impacto en personas' },
    ],
  },
  {
    id: 'q6',
    title: '¿Qué te motiva más un lunes?',
    measure: 'Motor de motivación laboral al inicio de semana.',
    options: [
      { id: 'A', text: 'Resolver un problema difícil.', trait: 'C', signal: 'Resolución analítica' },
      { id: 'B', text: 'Ayudar a un compañero.', trait: 'S', signal: 'Cooperación' },
      { id: 'C', text: 'Aprender algo totalmente nuevo.', trait: 'I', signal: 'Curiosidad y aprendizaje' },
    ],
  },
  {
    id: 'q7',
    title: 'Si el proyecto es un barco, tú eres:',
    measure: 'Posición natural dentro de la ejecución de proyectos.',
    options: [
      { id: 'A', text: 'El capitán.', trait: 'D', signal: 'Dirección' },
      { id: 'B', text: 'El motor.', trait: 'C', signal: 'Ejecución sostenida' },
      { id: 'C', text: 'El ancla.', trait: 'C', signal: 'Control y realismo' },
      { id: 'D', text: 'La vela.', trait: 'I', signal: 'Innovación' },
    ],
  },
];

const GamePersonality = ({
  onComplete,
  track,
  setPersonalityProfile,
}: GameProps & { setPersonalityProfile: (profile: string) => void }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<PersonalityQuestionOption[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const questions = PERSONALITY_QUESTIONS;

  const completeAssessment = useCallback(
    (finalAnswers: PersonalityQuestionOption[]) => {
      const traitCounts: Record<PersonalityTraitId, number> = { D: 0, I: 0, S: 0, C: 0 };
      for (const answer of finalAnswers) traitCounts[answer.trait] += 1;

      const sorted = (Object.entries(traitCounts) as Array<[PersonalityTraitId, number]>).sort((a, b) => b[1] - a[1]);
      const dominant = sorted[0][0];
      const secondary = sorted[1][0];
      const dominantCount = sorted[0][1];
      const consistency = dominantCount / finalAnswers.length;
      const diversity = Object.values(traitCounts).filter((value) => value > 0).length;
      const score = clamp(Math.round(58 + consistency * 30 + diversity * 3), 0, 100);

      const label = personalityTraitMeta[dominant].label;
      setPersonalityProfile(label);

      track('game_submitted', {
        score,
        dominant,
        secondary,
        diversity,
        consistency: Number(consistency.toFixed(2)),
      });

      onComplete({
        score,
        metrics: {
          dominant_profile: dominant,
          dominant_label: personalityTraitMeta[dominant].label,
          secondary_profile: secondary,
          secondary_label: personalityTraitMeta[secondary].label,
          consistency_ratio: Number(consistency.toFixed(2)),
          diversity_index: Number((diversity / 4).toFixed(2)),
          disc_d_pct: Math.round((traitCounts.D / finalAnswers.length) * 100),
          disc_i_pct: Math.round((traitCounts.I / finalAnswers.length) * 100),
          disc_s_pct: Math.round((traitCounts.S / finalAnswers.length) * 100),
          disc_c_pct: Math.round((traitCounts.C / finalAnswers.length) * 100),
          q1_signal: finalAnswers[0]?.signal || '',
          q2_signal: finalAnswers[1]?.signal || '',
          q3_signal: finalAnswers[2]?.signal || '',
          q4_signal: finalAnswers[3]?.signal || '',
          q5_signal: finalAnswers[4]?.signal || '',
          q6_signal: finalAnswers[5]?.signal || '',
          q7_signal: finalAnswers[6]?.signal || '',
          q1_choice: finalAnswers[0]?.id || '',
          q2_choice: finalAnswers[1]?.id || '',
          q3_choice: finalAnswers[2]?.id || '',
          q4_choice: finalAnswers[3]?.id || '',
          q5_choice: finalAnswers[4]?.id || '',
          q6_choice: finalAnswers[5]?.id || '',
          q7_choice: finalAnswers[6]?.id || '',
        },
      });
    },
    [onComplete, setPersonalityProfile, track]
  );

  const handleAnswer = (option: PersonalityQuestionOption) => {
    track('decision_made', { question: currentQ + 1, option: option.id, trait: option.trait, signal: option.signal });
    const nextAnswers = [...answers, option];
    setAnswers(nextAnswers);
    setTransitioning(true);

    window.setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ((prev) => prev + 1);
        setTransitioning(false);
      } else {
        completeAssessment(nextAnswers);
      }
    }, 180);
  };

  const qData = questions[currentQ];

  return (
    <div className="w-full max-w-5xl mx-auto pt-8 px-4 animate-fade-in">
      <div className="max-w-xl mx-auto mb-7">
        <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className={`transition-all duration-200 ${transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
        <div className="text-center mb-10 space-y-3">
          <span className="text-cyan-600 font-bold tracking-widest uppercase text-xs">
            Pregunta {currentQ + 1} de {questions.length}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-stone-800 leading-tight max-w-3xl mx-auto">{qData.title}</h2>
          <p className="text-sm text-stone-500">Selecciona la opción que mejor te representa en contexto laboral.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {qData.options.map((opt, idx) => (
            <button
              key={`${currentQ}-${opt.id}`}
              onClick={() => handleAnswer(opt)}
              className="group relative bg-white rounded-xl p-5 shadow-sm border border-stone-200 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-cyan-400 flex items-center gap-4 text-left"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                  ['bg-blue-100 text-blue-600', 'bg-amber-100 text-amber-600', 'bg-emerald-100 text-emerald-600', 'bg-purple-100 text-purple-600'][idx % 4]
                } group-hover:bg-cyan-500 group-hover:text-white`}
              >
                {opt.id}
              </div>
              <span className="text-base font-medium text-stone-700">{opt.text}</span>
              <ChevronRight className="w-4 h-4 text-cyan-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const GameMemory = ({ onComplete, track }: GameProps) => {
  type ShapeCell = 0 | 1;
  type ShapeMatrix = ShapeCell[][];
  type GridCell = number | null;
  type GridMatrix = GridCell[][];
  type MemoryPuzzlePhase = 'memorize' | 'build' | 'feedback';
  type MemoryLevel = {
    level: number;
    name: string;
    gridSize: number;
    piecesCount: number;
    canRotate: boolean;
    memorizeMs: number;
    buildSec: number;
    decoys: number;
  };
  type PieceConfig = {
    id: number;
    shape: ShapeMatrix;
    color: string;
    initialRotation: number;
    isDecoy?: boolean;
  };
  type PlacedPiece = PieceConfig & {
    x: number;
    y: number;
    rotation: number;
  };
  type LevelOutcome = {
    success: boolean;
    timedOut: boolean;
    message: string;
  };

  const levels = useMemo<MemoryLevel[]>(
    () => [
      { level: 1, name: 'Concepto', gridSize: 4, piecesCount: 3, canRotate: true, memorizeMs: 7000, buildSec: 0, decoys: 0 },
      { level: 2, name: 'Estructura', gridSize: 4, piecesCount: 4, canRotate: true, memorizeMs: 6800, buildSec: 36, decoys: 0 },
      { level: 3, name: 'Precision', gridSize: 5, piecesCount: 4, canRotate: true, memorizeMs: 6400, buildSec: 38, decoys: 1 },
      { level: 4, name: 'Complejidad', gridSize: 5, piecesCount: 5, canRotate: true, memorizeMs: 6100, buildSec: 35, decoys: 1 },
      { level: 5, name: 'Maestro', gridSize: 6, piecesCount: 5, canRotate: true, memorizeMs: 5600, buildSec: 32, decoys: 1 },
    ],
    []
  );

  const shapes = useMemo<ShapeMatrix[]>(
    () => [
      [[1, 1], [1, 1]],
      [[1, 1, 1, 1]],
      [[0, 1, 0], [1, 1, 1]],
      [[1, 0], [1, 0], [1, 1]],
      [[0, 1], [0, 1], [1, 1]],
      [[0, 1, 1], [1, 1, 0]],
      [[1, 1, 0], [0, 1, 1]],
      [[1, 0], [1, 1], [0, 1]],
    ],
    []
  );

  const palette = useMemo(
    () => ['#Facc15', '#F472B6', '#818CF8', '#2DD4BF', '#FB923C', '#34D399', '#A78BFA', '#FB7185'],
    []
  );

  const boardCellSize = 42;
  const boardGap = 6;
  const inventoryCellSize = 24;
  const inventoryGap = 4;
  const boardPadding = 18;

  const memoryPhaseTransitions = useMemo<TransitionMap<MemoryPuzzlePhase>>(
    () => ({
      memorize: ['build'],
      build: ['feedback'],
      feedback: ['memorize'],
    }),
    []
  );
  const [phase, transitionPhase] = useStateMachine<MemoryPuzzlePhase>(
    'memorize',
    memoryPhaseTransitions,
    'gameMemory'
  );
  const [levelIdx, setLevelIdx] = useState(0);
  const [memorizeTimeLeftMs, setMemorizeTimeLeftMs] = useState(0);
  const [buildTimeLeft, setBuildTimeLeft] = useState(0);

  const [targetGrid, setTargetGrid] = useState<GridMatrix>([]);
  const [availablePieces, setAvailablePieces] = useState<PieceConfig[]>([]);
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([]);
  const [rotationState, setRotationState] = useState<Record<number, number>>({});
  const [draggingPieceId, setDraggingPieceId] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [levelOutcome, setLevelOutcome] = useState<LevelOutcome | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const memorizeTimerRef = useRef<number | null>(null);
  const buildTimerRef = useRef<number | null>(null);
  const feedbackAdvanceTimerRef = useRef<number | null>(null);
  const feedbackFailSafeTimerRef = useRef<number | null>(null);
  const buildStartedAtRef = useRef<number>(0);
  const buildTimeoutHandledRef = useRef(false);
  const startedRef = useRef(false);
  const submittedRef = useRef(false);

  const correctRoundsRef = useRef(0);
  const missesRef = useRef(0);
  const roundRtRef = useRef<number[]>([]);

  const currentLevel = levels[levelIdx] || levels[0];
  const boardInnerSize = currentLevel.gridSize * boardCellSize + (currentLevel.gridSize - 1) * boardGap;
  const visibleRound = levelIdx + 1;
  const visibleTotal = levels.length;
  const levelGroupLabel = `Nivel ${visibleRound} / ${visibleTotal}`;
  const inBuildMode = phase === 'build';

  const clearMemorizeTimer = useCallback(() => {
    if (memorizeTimerRef.current) {
      clearInterval(memorizeTimerRef.current);
      memorizeTimerRef.current = null;
    }
  }, []);

  const clearBuildTimer = useCallback(() => {
    if (buildTimerRef.current) {
      clearInterval(buildTimerRef.current);
      buildTimerRef.current = null;
    }
  }, []);

  const clearFeedbackAdvanceTimer = useCallback(() => {
    if (feedbackAdvanceTimerRef.current) {
      clearTimeout(feedbackAdvanceTimerRef.current);
      feedbackAdvanceTimerRef.current = null;
    }
    if (feedbackFailSafeTimerRef.current) {
      clearTimeout(feedbackFailSafeTimerRef.current);
      feedbackFailSafeTimerRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearMemorizeTimer();
    clearBuildTimer();
    clearFeedbackAdvanceTimer();
  }, [clearBuildTimer, clearFeedbackAdvanceTimer, clearMemorizeTimer]);

  const createEmptyGrid = useCallback((size: number): GridMatrix => {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
  }, []);

  const rotateShape = useCallback((shape: ShapeMatrix): ShapeMatrix => {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated: ShapeMatrix = Array.from({ length: cols }, () =>
      Array.from({ length: rows }, () => 0 as ShapeCell)
    );

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        rotated[c][rows - 1 - r] = shape[r][c];
      }
    }

    return rotated;
  }, []);

  const getRotatedShape = useCallback(
    (shape: ShapeMatrix, turns: number) => {
      let next = shape;
      for (let i = 0; i < turns; i += 1) next = rotateShape(next);
      return next;
    },
    [rotateShape]
  );

  const canPlacePiece = useCallback((grid: GridMatrix, shape: ShapeMatrix, gridX: number, gridY: number) => {
    const gridSize = grid.length;

    for (let r = 0; r < shape.length; r += 1) {
      for (let c = 0; c < shape[r].length; c += 1) {
        if (!shape[r][c]) continue;
        const x = gridX + c;
        const y = gridY + r;
        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
        if (grid[y][x] !== null) return false;
      }
    }
    return true;
  }, []);

  const placePieceOnGrid = useCallback(
    (grid: GridMatrix, shape: ShapeMatrix, gridX: number, gridY: number, pieceId: number) => {
      const next = grid.map((row) => [...row]);
      for (let r = 0; r < shape.length; r += 1) {
        for (let c = 0; c < shape[r].length; c += 1) {
          if (!shape[r][c]) continue;
          next[gridY + r][gridX + c] = pieceId;
        }
      }
      return next;
    },
    []
  );

  const generatePuzzle = useCallback(
    (gridSize: number, pieceCount: number, decoysCount: number, allowRotation: boolean) => {
      let grid = createEmptyGrid(gridSize);
      const pieces: PieceConfig[] = [];
      let attempts = 0;

      while (pieces.length < pieceCount && attempts < 1200) {
        attempts += 1;
        const shapeBase = shapes[Math.floor(Math.random() * shapes.length)];
        const solutionRotation = allowRotation ? Math.floor(Math.random() * 4) : 0;
        const solutionShape = getRotatedShape(shapeBase, solutionRotation);

        for (let t = 0; t < 70; t += 1) {
          const gx = Math.floor(Math.random() * gridSize);
          const gy = Math.floor(Math.random() * gridSize);
          if (!canPlacePiece(grid, solutionShape, gx, gy)) continue;

          const id = pieces.length;
          pieces.push({
            id,
            shape: shapeBase,
            color: palette[id % palette.length],
            initialRotation: 0,
            isDecoy: false,
          });
          grid = placePieceOnGrid(grid, solutionShape, gx, gy, id);
          break;
        }
      }

      for (let i = 0; i < decoysCount; i += 1) {
        pieces.push({
          id: 900 + i,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          color: palette[(pieces.length + 2) % palette.length],
          initialRotation: 0,
          isDecoy: true,
        });
      }

      return { targetGrid: grid, pieces: [...pieces].sort(() => Math.random() - 0.5) };
    },
    [canPlacePiece, createEmptyGrid, getRotatedShape, palette, placePieceOnGrid, shapes]
  );

  const finalizeGame = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    clearAllTimers();

    const accuracy = correctRoundsRef.current / levels.length;
    const avgRt = Math.round(avg(roundRtRef.current));
    const consistencyIndex = clamp(Math.round(100 - stdDev(roundRtRef.current) / 25), 0, 100);
    const speedBonus = avgRt > 0 ? clamp(Math.round((52000 - avgRt) / 4500), 0, 8) : 0;
    let score = clamp(
      Math.round(
        accuracy * 74 +
          clamp((consistencyIndex - 55) * 0.12, -6, 6) +
          speedBonus -
          missesRef.current * 6
      ),
      0,
      100
    );

    if (correctRoundsRef.current <= 1) score = Math.min(score, 16);
    else if (correctRoundsRef.current === 2) score = Math.min(score, 34);
    else if (correctRoundsRef.current === 3) score = Math.min(score, 56);
    else if (correctRoundsRef.current === 4) score = Math.min(score, 82);

    track('game_submitted', {
      score,
      correctRounds: correctRoundsRef.current,
      misses: missesRef.current,
      avgRt,
    });

    onComplete({
      score,
      metrics: {
        correct_rounds: correctRoundsRef.current,
        total_rounds: levels.length,
        misses: missesRef.current,
        accuracy: Number(accuracy.toFixed(2)),
        avg_rt_ms: avgRt,
        consistency_index: consistencyIndex,
      },
    });
  }, [clearAllTimers, levels.length, onComplete, track]);

  const startLevel = useCallback(
    (nextLevelIdx: number) => {
      clearAllTimers();
      const safeLevelIdx = clamp(nextLevelIdx, 0, levels.length - 1);
      const cfg = levels[safeLevelIdx];
      const { targetGrid: nextTarget, pieces } = generatePuzzle(cfg.gridSize, cfg.piecesCount, cfg.decoys, cfg.canRotate);

      const initialRotations: Record<number, number> = {};
      for (const piece of pieces) initialRotations[piece.id] = piece.initialRotation;

      setLevelIdx(safeLevelIdx);
      setTargetGrid(nextTarget);
      setAvailablePieces(pieces);
      setPlacedPieces([]);
      setRotationState(initialRotations);
      setDraggingPieceId(null);
      setGhostPosition(null);
      setMemorizeTimeLeftMs(cfg.memorizeMs);
      setBuildTimeLeft(cfg.buildSec);
      setLevelOutcome(null);
      transitionPhase('memorize', { force: true });
      buildStartedAtRef.current = 0;
      buildTimeoutHandledRef.current = false;

      track('round_started', {
        round: safeLevelIdx + 1,
        gridSize: cfg.gridSize,
        pieces: cfg.piecesCount,
        decoys: cfg.decoys,
      });
    },
    [clearAllTimers, generatePuzzle, levels, track]
  );

  const startLevelRef = useRef(startLevel);
  useEffect(() => {
    startLevelRef.current = startLevel;
  }, [startLevel]);

  const finalizeGameRef = useRef(finalizeGame);
  useEffect(() => {
    finalizeGameRef.current = finalizeGame;
  }, [finalizeGame]);

  const advanceAfterFeedback = useCallback(() => {
    clearFeedbackAdvanceTimer();
    const nextLevel = levelIdx + 1;
    if (nextLevel >= levels.length) {
      finalizeGameRef.current();
      return;
    }
    startLevelRef.current(nextLevel);
  }, [clearFeedbackAdvanceTimer, levelIdx, levels.length]);

  const buildOccupancyGrid = useCallback(
    (excludePieceId: number | null = null) => {
      const occupancy = createEmptyGrid(currentLevel.gridSize);

      for (const placed of placedPieces) {
        if (excludePieceId !== null && placed.id === excludePieceId) continue;
        const shape = getRotatedShape(placed.shape, placed.rotation);
        for (let r = 0; r < shape.length; r += 1) {
          for (let c = 0; c < shape[r].length; c += 1) {
            if (!shape[r][c]) continue;
            const x = placed.x + c;
            const y = placed.y + r;
            if (x < 0 || x >= currentLevel.gridSize || y < 0 || y >= currentLevel.gridSize) continue;
            occupancy[y][x] = placed.id;
          }
        }
      }
      return occupancy;
    },
    [createEmptyGrid, currentLevel.gridSize, getRotatedShape, placedPieces]
  );

  const calculateGridPosition = useCallback(
    (clientX: number, clientY: number, shape: ShapeMatrix) => {
      if (!boardRef.current) return null;
      const rect = boardRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left - boardPadding;
      const relativeY = clientY - rect.top - boardPadding;

      const shapeWidth = shape[0].length * (boardCellSize + boardGap) - boardGap;
      const shapeHeight = shape.length * (boardCellSize + boardGap) - boardGap;

      const x = Math.round((relativeX - shapeWidth / 2) / (boardCellSize + boardGap));
      const y = Math.round((relativeY - shapeHeight / 2) / (boardCellSize + boardGap));
      return { x, y };
    },
    [boardCellSize, boardGap]
  );

  const validateCurrentLevel = useCallback(
    (timedOut = false) => {
      if (phase !== 'build') return;
      clearBuildTimer();

      const occupancy = createEmptyGrid(currentLevel.gridSize);
      let hasCollisionOrOut = false;
      let decoyUsed = false;

      for (const placed of placedPieces) {
        if (placed.isDecoy || placed.id >= 900) decoyUsed = true;
        const shape = getRotatedShape(placed.shape, placed.rotation);
        for (let r = 0; r < shape.length; r += 1) {
          for (let c = 0; c < shape[r].length; c += 1) {
            if (!shape[r][c]) continue;
            const x = placed.x + c;
            const y = placed.y + r;
            if (x < 0 || x >= currentLevel.gridSize || y < 0 || y >= currentLevel.gridSize) {
              hasCollisionOrOut = true;
              continue;
            }
            if (occupancy[y][x] !== null) hasCollisionOrOut = true;
            occupancy[y][x] = placed.id;
          }
        }
      }

      let occupancyMatches = !hasCollisionOrOut;
      for (let r = 0; r < currentLevel.gridSize; r += 1) {
        for (let c = 0; c < currentLevel.gridSize; c += 1) {
          const targetCell = targetGrid[r]?.[c] !== null ? 1 : 0;
          const currentCell = occupancy[r]?.[c] !== null ? 1 : 0;
          if (targetCell !== currentCell) occupancyMatches = false;
        }
      }

      const success = occupancyMatches && !decoyUsed;
      const rtMs = Math.max(0, Date.now() - buildStartedAtRef.current);
      roundRtRef.current.push(rtMs);

      if (success) {
        correctRoundsRef.current += 1;
        track('decision_made', { type: 'memory_blueprint_match', round: levelIdx + 1, rtMs });
      } else {
        missesRef.current += 1;
        track('error_committed', {
          type: timedOut ? 'memory_blueprint_timeout' : 'memory_blueprint_mismatch',
          round: levelIdx + 1,
          rtMs,
          decoyUsed,
        });
      }

      setLevelOutcome({
        success,
        timedOut,
        message: success
          ? 'La estructura coincide con el diseño.'
          : timedOut
            ? 'Se agoto el tiempo del nivel.'
            : 'La estructura no coincide con el diseño.',
      });
      setDraggingPieceId(null);
      setGhostPosition(null);
      transitionPhase('feedback');
    },
    [clearBuildTimer, createEmptyGrid, currentLevel.gridSize, getRotatedShape, levelIdx, phase, placedPieces, targetGrid, track, transitionPhase]
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startLevel(0);
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers, startLevel]);

  useEffect(() => {
    if (phase !== 'memorize') return;
    clearMemorizeTimer();

    const startedAt = Date.now();
    const initial = currentLevel.memorizeMs;
    setMemorizeTimeLeftMs(initial);

    memorizeTimerRef.current = window.setInterval(() => {
      const remaining = Math.max(0, initial - (Date.now() - startedAt));
      setMemorizeTimeLeftMs(remaining);

      if (remaining <= 0) {
        clearMemorizeTimer();
        transitionPhase('build');
        buildStartedAtRef.current = Date.now();
        buildTimeoutHandledRef.current = false;
        setBuildTimeLeft(currentLevel.buildSec);
      }
    }, 50);

    return clearMemorizeTimer;
  }, [clearMemorizeTimer, currentLevel.buildSec, currentLevel.memorizeMs, phase, transitionPhase]);

  useEffect(() => {
    if (phase !== 'build') return;
    clearBuildTimer();
    if (currentLevel.buildSec <= 0) return;

    setBuildTimeLeft(currentLevel.buildSec);
    buildTimerRef.current = window.setInterval(() => {
      setBuildTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return clearBuildTimer;
  }, [clearBuildTimer, currentLevel.buildSec, phase]);

  useEffect(() => {
    if (phase !== 'build') return;
    if (currentLevel.buildSec <= 0) return;
    if (buildTimeLeft > 0) return;
    if (buildTimeoutHandledRef.current) return;
    buildTimeoutHandledRef.current = true;
    validateCurrentLevel(true);
  }, [buildTimeLeft, currentLevel.buildSec, phase, validateCurrentLevel]);

  useEffect(() => {
    if (phase !== 'feedback' || !levelOutcome) return;
    clearFeedbackAdvanceTimer();
    feedbackAdvanceTimerRef.current = window.setTimeout(() => {
      advanceAfterFeedback();
    }, 1050);
    // Guard rail: si el timeout principal no corre por cualquier motivo, fuerza avance.
    feedbackFailSafeTimerRef.current = window.setTimeout(() => {
      advanceAfterFeedback();
    }, 2400);
    return clearFeedbackAdvanceTimer;
  }, [advanceAfterFeedback, clearFeedbackAdvanceTimer, levelOutcome, phase]);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>, pieceId: number, fromBoard: boolean) => {
    if (!inBuildMode) return;

    if (fromBoard) {
      setPlacedPieces((prev) => prev.filter((piece) => piece.id !== pieceId));
    }

    setDraggingPieceId(pieceId);
    setDragPosition({ x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPieceId === null || !inBuildMode) return;
    setDragPosition({ x: event.clientX, y: event.clientY });

    const piece = availablePieces.find((item) => item.id === draggingPieceId);
    if (!piece) return;

    const rotation = rotationState[piece.id] || 0;
    const shape = getRotatedShape(piece.shape, rotation);
    const position = calculateGridPosition(event.clientX, event.clientY, shape);
    if (!position) {
      setGhostPosition(null);
      return;
    }

    const occupancy = buildOccupancyGrid(draggingPieceId);
    if (canPlacePiece(occupancy, shape, position.x, position.y)) {
      setGhostPosition(position);
      return;
    }
    setGhostPosition(null);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPieceId === null || !inBuildMode) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    const piece = availablePieces.find((item) => item.id === draggingPieceId);
    if (piece && ghostPosition) {
      const rotation = rotationState[piece.id] || 0;
      setPlacedPieces((prev) => [...prev, { ...piece, x: ghostPosition.x, y: ghostPosition.y, rotation }]);
      track('decision_made', {
        type: 'memory_piece_placed',
        round: levelIdx + 1,
        pieceId: piece.id,
        x: ghostPosition.x,
        y: ghostPosition.y,
        decoy: Boolean(piece.isDecoy),
      });
    }

    setDraggingPieceId(null);
    setGhostPosition(null);
  };

  const handleRotatePiece = (event: React.MouseEvent<HTMLButtonElement>, pieceId: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (!inBuildMode || !currentLevel.canRotate) return;

    setRotationState((prev) => {
      const next = ((prev[pieceId] || 0) + 1) % 4;
      return { ...prev, [pieceId]: next };
    });
    track('decision_made', { type: 'memory_piece_rotated', round: levelIdx + 1, pieceId });
  };

  const handleUndoLastPlacement = useCallback(() => {
    if (!inBuildMode) return;
    setPlacedPieces((prev) => {
      if (!prev.length) return prev;
      const removed = prev[prev.length - 1];
      track('decision_changed', {
        type: 'memory_undo_piece',
        round: levelIdx + 1,
        pieceId: removed.id,
      });
      return prev.slice(0, -1);
    });
    setGhostPosition(null);
  }, [inBuildMode, levelIdx, track]);

  const handleClearBoard = useCallback(() => {
    if (!inBuildMode || !placedPieces.length) return;
    const removedCount = placedPieces.length;
    setPlacedPieces([]);
    setGhostPosition(null);
    setDraggingPieceId(null);
    track('decision_changed', {
      type: 'memory_clear_board',
      round: levelIdx + 1,
      removedCount,
    });
  }, [inBuildMode, levelIdx, placedPieces.length, track]);

  const renderShape = (
    shape: ShapeMatrix,
    color: string,
    rotation: number,
    cellSize: number,
    ghost = false,
    gap = boardGap
  ) => {
    const rotated = getRotatedShape(shape, rotation);
    const rows = rotated.length;
    const cols = rotated[0].length;
    const width = cols * cellSize + (cols - 1) * gap;
    const height = rows * cellSize + (rows - 1) * gap;

    return (
      <div className="relative" style={{ width, height }}>
        {rotated.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            return (
              <div
                key={`${r}-${c}`}
                className={`absolute rounded-md ${ghost ? 'border-2 border-dashed border-cyan-300 bg-cyan-100/40' : 'shadow-sm'}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: c * (cellSize + gap),
                  top: r * (cellSize + gap),
                  backgroundColor: ghost ? undefined : color,
                  boxShadow: ghost
                    ? undefined
                    : 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 0 rgba(0,0,0,0.12)',
                }}
              />
            );
          })
        )}
      </div>
    );
  };

  const pieceColorById = useMemo(() => {
    const byId = new Map<number, string>();
    for (const piece of availablePieces) byId.set(piece.id, piece.color);
    return byId;
  }, [availablePieces]);

  const inventoryPieces = availablePieces.filter((piece) => !placedPieces.some((placed) => placed.id === piece.id));

  return (
    <div
      className="w-full max-w-6xl mx-auto pt-8 px-4 animate-fade-in touch-none select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      <div className="text-center mb-6">
        <div className="text-xs font-bold uppercase tracking-wide text-cyan-600 mb-1">{levelGroupLabel}</div>
        <h3 className="text-lg text-cyan-600 font-bold uppercase tracking-widest">
          Ronda {visibleRound} / {visibleTotal}
        </h3>
        <p className="text-stone-600 text-sm mt-2">
          {phase === 'memorize'
            ? `Memoriza la estructura · ${Math.max(0, Math.ceil(memorizeTimeLeftMs / 1000))}s`
            : currentLevel.buildSec > 0
              ? `Reconstruye la estructura · ${buildTimeLeft}s`
              : 'Reconstruye la estructura sin límite de tiempo'}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
        <Card className="p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-stone-400">Diseño</div>
              <div className="text-lg font-bold text-stone-700">{currentLevel.name}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider font-bold text-stone-400">Fase</div>
              <div className="text-base font-semibold text-cyan-700">{phase === 'memorize' ? 'Memorizar' : 'Construir'}</div>
            </div>
          </div>

          <div
            ref={boardRef}
            data-testid="memory-board"
            className="relative mx-auto rounded-2xl border border-stone-200 bg-stone-50 p-[18px]"
            style={{ width: boardInnerSize + boardPadding * 2 }}
          >
            <div className="relative" style={{ width: boardInnerSize, height: boardInnerSize }}>
              {Array.from({ length: currentLevel.gridSize }).map((_, row) =>
                Array.from({ length: currentLevel.gridSize }).map((__, col) => (
                  <div
                    key={`slot-${row}-${col}`}
                    className="absolute rounded-md border border-stone-200/70 bg-stone-100"
                    style={{
                      width: boardCellSize,
                      height: boardCellSize,
                      left: col * (boardCellSize + boardGap),
                      top: row * (boardCellSize + boardGap),
                    }}
                  />
                ))
              )}

              {phase === 'memorize'
                ? targetGrid.map((row, r) =>
                    row.map((cell, c) => {
                      if (cell === null) return null;
                      const color = pieceColorById.get(cell) || '#14b8a6';
                      return (
                        <div
                          key={`target-${r}-${c}`}
                          className="absolute rounded-md shadow-sm"
                          style={{
                            width: boardCellSize,
                            height: boardCellSize,
                            left: c * (boardCellSize + boardGap),
                            top: r * (boardCellSize + boardGap),
                            backgroundColor: color,
                          }}
                        />
                      );
                    })
                  )
                : null}

              {phase === 'build' && ghostPosition && draggingPieceId !== null
                ? (() => {
                    const ghostPiece = availablePieces.find((piece) => piece.id === draggingPieceId);
                    if (!ghostPiece) return null;
                    return (
                      <div
                        className="absolute pointer-events-none z-0"
                        style={{
                          left: ghostPosition.x * (boardCellSize + boardGap),
                          top: ghostPosition.y * (boardCellSize + boardGap),
                        }}
                      >
                        {renderShape(
                          ghostPiece.shape,
                          ghostPiece.color,
                          rotationState[ghostPiece.id] || 0,
                          boardCellSize,
                          true
                        )}
                      </div>
                    );
                  })()
                : null}

              {phase !== 'memorize'
                ? placedPieces.map((placed) => (
                    <div
                      key={`placed-${placed.id}`}
                      className={`absolute z-10 ${phase === 'build' ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                      style={{
                        left: placed.x * (boardCellSize + boardGap),
                        top: placed.y * (boardCellSize + boardGap),
                      }}
                      onPointerDown={(event) => handlePointerDown(event, placed.id, true)}
                    >
                      {renderShape(placed.shape, placed.color, rotationState[placed.id] || 0, boardCellSize, false)}
                      {currentLevel.canRotate && phase === 'build' ? (
                        <button
                          className="absolute -top-2 -right-2 bg-white border border-stone-200 rounded-full p-1.5 text-stone-600 hover:text-cyan-700"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => handleRotatePiece(event, placed.id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))
                : null}

              {phase === 'feedback' && levelOutcome ? (
                <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                  <div
                    className={`px-6 py-4 rounded-2xl border shadow-lg flex items-center gap-3 animate-[memoryBadge_220ms_ease-out] ${
                      levelOutcome.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {levelOutcome.success ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                    <div>
                      <div className="text-lg font-bold">{levelOutcome.success ? 'Correcto!' : 'Incorrecto'}</div>
                      <div className="text-xs opacity-80">{levelOutcome.message}</div>
                    </div>
                    <button
                      type="button"
                      onClick={advanceAfterFeedback}
                      className="ml-3 rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white transition-colors"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className={`p-4 space-y-4 ${phase !== 'build' ? 'opacity-60 pointer-events-none' : ''}`}>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-1">Inventario</div>
            <div className="text-sm text-stone-600">Arrastra y rota piezas para reconstruir la forma exacta.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-2 max-h-[360px] overflow-y-auto pr-1">
            {inventoryPieces.length ? (
              inventoryPieces.map((piece) => (
                <div
                  key={`inventory-${piece.id}`}
                  data-testid={`memory-piece-${piece.id}`}
                  className="relative min-h-[108px] rounded-lg border border-stone-200 bg-stone-50 p-2 cursor-grab active:cursor-grabbing hover:bg-white flex items-center justify-center overflow-visible"
                  onPointerDown={(event) => handlePointerDown(event, piece.id, false)}
                >
                  {renderShape(piece.shape, piece.color, rotationState[piece.id] || 0, inventoryCellSize, false, inventoryGap)}
                  {currentLevel.canRotate ? (
                    <button
                      className="absolute top-1 right-1 bg-white border border-stone-200 rounded-full p-1 text-stone-500 hover:text-cyan-700"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => handleRotatePiece(event, piece.id)}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="sm:col-span-2 text-center text-sm text-stone-400 py-8">Todas las piezas fueron utilizadas.</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="w-full px-3 py-2 text-xs sm:text-sm"
              onClick={handleUndoLastPlacement}
              disabled={!placedPieces.length}
            >
              Deshacer última
            </Button>
            <Button
              variant="secondary"
              className="w-full px-3 py-2 text-xs sm:text-sm"
              onClick={handleClearBoard}
              disabled={!placedPieces.length}
            >
              Limpiar tablero
            </Button>
          </div>

          <Button onClick={() => validateCurrentLevel(false)} className="w-full">
            <span data-testid="memory-verify" className="contents">
              Verificar estructura
            </span>
          </Button>
        </Card>
      </div>

      {draggingPieceId !== null
        ? (() => {
            const piece = availablePieces.find((item) => item.id === draggingPieceId);
            if (!piece) return null;
            return (
              <div
                className="fixed pointer-events-none z-[100]"
                style={{
                  left: dragPosition.x,
                  top: dragPosition.y,
                  transform: 'translate(-50%, -50%) rotate(4deg) scale(1.03)',
                  filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.22))',
                }}
              >
                {renderShape(piece.shape, piece.color, rotationState[piece.id] || 0, boardCellSize)}
              </div>
            );
          })()
        : null}

      <style jsx>{`
        @keyframes memoryBadge {
          0% {
            transform: scale(0.92) translateY(6px);
            opacity: 0;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

type LeadershipTaskType = 'Coordinación' | 'Análisis' | 'Ejecución';
type LeadershipRoundId = 'round1' | 'round2';

type LeadershipTask = {
  id: string;
  name: string;
  type: LeadershipTaskType;
  cost: number;
  criticality: 1 | 2 | 3;
  narrative: string;
};

type LeadershipRoundEval = {
  roundScore: number;
  roleMatches: number;
  mismatchCount: number;
  technicalMismatchCount: number;
  criticalMismatchCount: number;
  overloadCount: number;
  unresolvedCritical: number;
  avgLoad: number;
  loadStd: number;
};

type LeadershipActionTone = 'success' | 'warning' | 'danger' | 'neutral';

const GameLeadership = ({ onComplete, track }: GameProps) => {
  const members = useMemo(
    () => [
      {
        id: 1,
        name: 'Mara',
        strength: 'Da claridad cuando hay señales confusas.',
        role: 'Análisis' as LeadershipTaskType,
        baseLoad: 18,
      },
      {
        id: 2,
        name: 'Bruno',
        strength: 'Excelente resolviendo bloqueos en momentos de urgencia.',
        role: 'Ejecución' as LeadershipTaskType,
        baseLoad: 28,
      },
      {
        id: 3,
        name: 'Inés',
        strength: 'Sostiene acuerdos y comunicación clara bajo presión.',
        role: 'Coordinación' as LeadershipTaskType,
        baseLoad: 16,
      },
    ],
    []
  );

  const memberById = useMemo(() => {
    const map: Record<number, (typeof members)[number]> = {};
    for (const member of members) map[member.id] = member;
    return map;
  }, [members]);

  const round1Tasks = useMemo<LeadershipTask[]>(
    () => [
      {
        id: 'r1_t1',
        name: 'Alinear mensaje con las personas involucradas',
        type: 'Coordinación',
        cost: 24,
        criticality: 2,
        narrative: 'Mantener calma, expectativas claras y prioridades comunes.',
      },
      {
        id: 'r1_t2',
        name: 'Revisar datos del problema',
        type: 'Análisis',
        cost: 20,
        criticality: 2,
        narrative: 'Detectar causa probable y alcance real del impacto.',
      },
      {
        id: 'r1_t3',
        name: 'Resolver bloqueo principal',
        type: 'Ejecución',
        cost: 26,
        criticality: 3,
        narrative: 'Aplicar acción directa para restablecer continuidad.',
      },
      {
        id: 'r1_t4',
        name: 'Actualizar estado al equipo',
        type: 'Coordinación',
        cost: 16,
        criticality: 1,
        narrative: 'Evitar desalineación y reducir ruido operativo.',
      },
      {
        id: 'r1_t5',
        name: 'Priorizar casos urgentes',
        type: 'Análisis',
        cost: 17,
        criticality: 2,
        narrative: 'Ordenar tareas por impacto y tiempo de respuesta.',
      },
    ],
    []
  );

  const [phase, setPhase] = useState<'story' | 'round1' | 'round2'>('story');
  const [storyStep, setStoryStep] = useState(0);
  const [round2Tasks, setRound2Tasks] = useState<LeadershipTask[]>([]);
  const [assignments, setAssignments] = useState<Record<LeadershipRoundId, Record<string, number>>>({
    round1: {},
    round2: {},
  });
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [carryBaseLoad, setCarryBaseLoad] = useState<Record<number, number>>({});
  const [incidentPressure, setIncidentPressure] = useState(0);
  const [reassignments, setReassignments] = useState(0);
  const [overloadWarnings, setOverloadWarnings] = useState(0);
  const [actionFeedback, setActionFeedback] = useState<{ tone: LeadershipActionTone; message: string } | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [showAssignedTasks, setShowAssignedTasks] = useState(false);

  const activeRoundId: LeadershipRoundId = phase === 'round2' ? 'round2' : 'round1';
  const activeTasks = phase === 'round2' ? round2Tasks : round1Tasks;
  const activeAssignments = assignments[activeRoundId];
  const selectedTaskDef = selectedTask ? activeTasks.find((task) => task.id === selectedTask) ?? null : null;
  const pendingTasksCount = activeTasks.filter((task) => !activeAssignments[task.id]).length;
  const visibleTasks = useMemo(
    () =>
      showAssignedTasks
        ? activeTasks
        : activeTasks.filter((task) => !activeAssignments[task.id] || task.id === selectedTask),
    [activeAssignments, activeTasks, selectedTask, showAssignedTasks]
  );

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 1700);
    return () => clearTimeout(timer);
  }, [actionFeedback]);

  const advanceStory = useCallback(() => {
    if (phase !== 'story') return;
    if (storyStep < 2) {
      setStoryStep((step) => step + 1);
      track('decision_made', { type: 'leadership_story_step', step: storyStep + 1 });
      return;
    }
    setPhase('round1');
    track('decision_made', { type: 'leadership_story_completed' });
  }, [phase, storyStep, track]);

  useEffect(() => {
    if (phase !== 'story') return;
    const timer = window.setTimeout(() => {
      advanceStory();
    }, 7000);
    return () => clearTimeout(timer);
  }, [advanceStory, phase, storyStep]);

  const getRoundBaseLoad = useCallback(
    (roundId: LeadershipRoundId, memberId: number) => {
      const member = memberById[memberId];
      if (!member) return 0;
      if (roundId === 'round2') {
        return carryBaseLoad[memberId] ?? member.baseLoad;
      }
      return member.baseLoad;
    },
    [memberById, carryBaseLoad]
  );

  const getLoad = useCallback(
    (roundId: LeadershipRoundId, memberId: number, map: Record<string, number>, tasks: LeadershipTask[]) => {
      let load = getRoundBaseLoad(roundId, memberId);
      for (const task of tasks) {
        if (map[task.id] === memberId) {
          load += task.cost;
        }
      }
      return load;
    },
    [getRoundBaseLoad]
  );

  const evaluateRound = useCallback(
    (roundId: LeadershipRoundId, tasks: LeadershipTask[], map: Record<string, number>): LeadershipRoundEval => {
      let points = 0;
      let roleMatches = 0;
      let mismatchCount = 0;
      let technicalMismatchCount = 0;
      let criticalMismatchCount = 0;
      let overloadCount = 0;
      let unresolvedCritical = 0;

      for (const task of tasks) {
        const memberId = map[task.id];
        if (!memberId) continue;
        const member = memberById[memberId];
        if (!member) continue;

        const roleMatch = member.role === task.type;
        const load = getLoad(roundId, memberId, map, tasks);

        points += roleMatch ? 20 : 6;
        if (task.criticality === 3) points += roleMatch ? 10 : -14;
        if (task.criticality === 2) points += roleMatch ? 5 : -6;

        if (load <= 90) points += 8;
        else if (load <= 102) points += 5;
        else if (load <= 110) points += 2;
        else {
          points -= 10;
          overloadCount += 1;
        }

        if (roleMatch) roleMatches += 1;
        else mismatchCount += 1;

        if (task.type === 'Ejecución' && !roleMatch) technicalMismatchCount += 1;
        if (task.criticality >= 2 && !roleMatch) criticalMismatchCount += 1;
        if (task.criticality === 3 && !roleMatch) unresolvedCritical += 1;
      }

      const loads = members.map((member) => getLoad(roundId, member.id, map, tasks));
      const maxPoints = Math.max(1, tasks.length * 38);

      return {
        roundScore: clamp(Math.round((points / maxPoints) * 100), 0, 100),
        roleMatches,
        mismatchCount,
        technicalMismatchCount,
        criticalMismatchCount,
        overloadCount,
        unresolvedCritical,
        avgLoad: Math.round(avg(loads)),
        loadStd: Number(stdDev(loads).toFixed(2)),
      };
    },
    [getLoad, memberById, members]
  );

  const buildRound2Tasks = useCallback((pressure: number): LeadershipTask[] => {
    const tasks: LeadershipTask[] = [
      {
        id: 'r2_t1',
        name: 'Seguimiento de acuerdos clave',
        type: 'Coordinación',
        cost: 18,
        criticality: 2,
        narrative: 'Confirmar avances y sostener confianza de las partes.',
      },
      {
        id: 'r2_t2',
        name: 'Análisis de causa y prevención',
        type: 'Análisis',
        cost: 18,
        criticality: 2,
        narrative: 'Extraer aprendizajes para evitar repetición.',
      },
    ];

    if (pressure >= 18) {
      tasks.push({
        id: 'r2_t3',
        name: 'Cerrar bloqueo de continuidad',
        type: 'Ejecución',
        cost: 22,
        criticality: 3,
        narrative: 'Cerrar el punto crítico antes del siguiente pico de demanda.',
      });
    }

    if (pressure >= 34) {
      tasks.push({
        id: 'r2_t4',
        name: 'Plan de respaldo y turnos',
        type: 'Coordinación',
        cost: 16,
        criticality: 2,
        narrative: 'Prevenir cuellos de botella en la etapa de estabilización.',
      });
    }

    return tasks;
  }, []);

  const handleAssign = (memberId: number) => {
    if (!selectedTask) return;

    const currentAssignments = assignments[activeRoundId];
    const previousMemberId = currentAssignments[selectedTask];
    const nextAssignments = { ...currentAssignments, [selectedTask]: memberId };
    const selectedTaskDef = activeTasks.find((task) => task.id === selectedTask);
    const projectedLoad = getLoad(activeRoundId, memberId, nextAssignments, activeTasks);

    if (previousMemberId && previousMemberId !== memberId) {
      setReassignments((value) => value + 1);
      track('decision_changed', { round: activeRoundId, taskId: selectedTask, from: previousMemberId, to: memberId });
    } else {
      track('decision_made', { round: activeRoundId, taskId: selectedTask, memberId });
    }

    if (selectedTaskDef && selectedTaskDef.type === 'Ejecución' && memberById[memberId]?.role !== 'Ejecución') {
      track('error_committed', {
        type: 'leadership_technical_mismatch',
        round: activeRoundId,
        taskId: selectedTaskDef.id,
        memberId,
      });
    }

    if (projectedLoad > 110) {
      setOverloadWarnings((value) => value + 1);
      track('error_committed', {
        type: 'leadership_overload',
        round: activeRoundId,
        taskId: selectedTask,
        memberId,
        projectedLoad,
      });
    }

    const taskMismatch = Boolean(selectedTaskDef && memberById[memberId] && selectedTaskDef.type !== memberById[memberId].role);
    if (projectedLoad > 110) {
      setActionFeedback({ tone: 'danger', message: 'Asignación registrada con sobrecarga inmediata.' });
    } else if (selectedTaskDef?.criticality === 3 && taskMismatch) {
      setActionFeedback({ tone: 'danger', message: 'Asignación crítica con riesgo operativo alto.' });
    } else if (projectedLoad > 102) {
      setActionFeedback({ tone: 'warning', message: 'Asignación guardada al límite de carga.' });
    } else {
      setActionFeedback({ tone: 'success', message: 'Asignación registrada correctamente.' });
    }

    setAssignments((prev) => ({
      ...prev,
      [activeRoundId]: nextAssignments,
    }));
    setSelectedTask(null);
  };

  const handleUnassign = (taskId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const nextAssignments = { ...assignments[activeRoundId] };
    delete nextAssignments[taskId];
    setAssignments((prev) => ({
      ...prev,
      [activeRoundId]: nextAssignments,
    }));
    setActionFeedback({ tone: 'neutral', message: 'Asignación removida. Puedes reasignar.' });
    track('decision_changed', { round: activeRoundId, taskId, action: 'unassign' });
  };

  const allAssignedCurrentRound = activeTasks.length > 0 && Object.keys(activeAssignments).length === activeTasks.length;

  const proceedToRound2 = () => {
    const round1Eval = evaluateRound('round1', round1Tasks, assignments.round1);
    const pressure = round1Eval.technicalMismatchCount * 14 + round1Eval.criticalMismatchCount * 8 + round1Eval.overloadCount * 6;

    const carryLoads: Record<number, number> = {};
    for (const member of members) {
      const round1Load = getLoad('round1', member.id, assignments.round1, round1Tasks);
      const overflow = Math.max(0, round1Load - member.baseLoad);
      carryLoads[member.id] = clamp(Math.round(member.baseLoad + overflow * 0.35), member.baseLoad, 95);
    }

    const nextRound2Tasks = buildRound2Tasks(pressure);

    setCarryBaseLoad(carryLoads);
    setRound2Tasks(nextRound2Tasks);
    setIncidentPressure(pressure);
    setSelectedTask(null);
    setPhase('round2');

    track('round_completed', {
      round: 'round1',
      roundScore: round1Eval.roundScore,
      incidentPressure: pressure,
      round2TaskCount: nextRound2Tasks.length,
    });
  };

  const finalize = () => {
    const round1Eval = evaluateRound('round1', round1Tasks, assignments.round1);
    const round2Eval = evaluateRound('round2', round2Tasks, assignments.round2);

    const recoveryIndex = clamp(
      Math.round(
        100 -
          incidentPressure +
          round2Eval.roleMatches * 8 -
          round2Eval.technicalMismatchCount * 12 -
          round2Eval.unresolvedCritical * 10 -
          round2Eval.overloadCount * 8
      ),
      0,
      100
    );

    const disciplineIndex = clamp(100 - reassignments * 3 - overloadWarnings * 2, 0, 100);
    const finalScore = clamp(
      Math.round(round1Eval.roundScore * 0.45 + round2Eval.roundScore * 0.4 + ((recoveryIndex + disciplineIndex) / 2) * 0.15),
      0,
      100
    );

    const totalTasks = round1Tasks.length + round2Tasks.length;
    const totalRoleMatches = round1Eval.roleMatches + round2Eval.roleMatches;
    const totalMismatches = round1Eval.mismatchCount + round2Eval.mismatchCount;
    const totalTechnicalMismatch = round1Eval.technicalMismatchCount + round2Eval.technicalMismatchCount;
    const totalCriticalMismatch = round1Eval.criticalMismatchCount + round2Eval.criticalMismatchCount;

    track('game_submitted', {
      score: finalScore,
      round1Score: round1Eval.roundScore,
      round2Score: round2Eval.roundScore,
      recoveryIndex,
      disciplineIndex,
      totalMismatches,
      technicalMismatch: totalTechnicalMismatch,
      criticalMismatch: totalCriticalMismatch,
    });

    onComplete({
      score: finalScore,
      metrics: {
        role_match_count: totalRoleMatches,
        role_match_rate: Number((totalRoleMatches / totalTasks).toFixed(2)),
        mismatch_count: totalMismatches,
        technical_mismatch_count: totalTechnicalMismatch,
        critical_mismatch_count: totalCriticalMismatch,
        reassignments,
        overload_warnings: overloadWarnings,
        round1_score: round1Eval.roundScore,
        round2_score: round2Eval.roundScore,
        recovery_index: recoveryIndex,
        incident_pressure: incidentPressure,
        avg_team_load: Math.round((round1Eval.avgLoad + round2Eval.avgLoad) / 2),
        load_std_dev: Number(((round1Eval.loadStd + round2Eval.loadStd) / 2).toFixed(2)),
      },
    });
  };

  if (phase === 'story') {
    const storyScreens = [
      {
        eyebrow: 'Puesta en situación',
        title: 'Tu equipo entra en una jornada critica',
        lines: [
          'Hay demoras y reclamos. Necesitas organizar al equipo para recuperar estabilidad.',
          'Tus decisiones impactan la calidad final y la carga de cada persona.',
        ],
      },
      {
        eyebrow: 'Qué está en juego',
        title: 'Recursos limitados, prioridades en conflicto',
        lines: [
          'No puedes asignar todo a la misma persona: el agotamiento reduce el rendimiento.',
          'Habrá una segunda etapa con nuevas exigencias según lo que decidas ahora.',
        ],
      },
      {
        eyebrow: 'Como se juega',
        title: 'Objetivo en menos de 10 segundos',
        lines: [
          '1) Selecciona una tarea.',
          '2) Asignala a quien tenga mejor perfil y carga.',
          '3) Completa el plan y ajusta en la segunda etapa.',
        ],
      },
    ];
    const screen = storyScreens[storyStep];

    return (
      <div className="w-full max-w-4xl mx-auto animate-fade-in pt-8 px-4">
        <Card className="border-l-4 border-l-cyan-500 space-y-5">
          <div>
            <div className="text-xs font-bold text-cyan-600 uppercase tracking-wide mb-2">{screen.eyebrow}</div>
            <h3 className="text-2xl font-bold text-stone-800">{screen.title}</h3>
            <div className="space-y-2 mt-3">
              {screen.lines.map((line) => (
                <p key={line} className="text-sm text-stone-600 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${((storyStep + 1) / storyScreens.length) * 100}%` }} />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={advanceStory}
              className="px-8"
            >
              {storyStep < storyScreens.length - 1 ? 'Siguiente' : 'Iniciar nivel 1'} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const feedbackToneClass: Record<LeadershipActionTone, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    danger: 'bg-red-50 border-red-200 text-red-700',
    neutral: 'bg-stone-50 border-stone-200 text-stone-700',
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in pt-8 px-4 space-y-4">
      <Card className="p-4 border-stone-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wide text-cyan-600">
              {phase === 'round1' ? 'Nivel 1 · Contención inicial' : 'Nivel 2 · Recuperación operativa'}
            </div>
            <h3 className="text-lg font-bold text-stone-800">
              {phase === 'round1' ? 'Asigna el primer bloque de respuesta' : 'Gestiona la segunda ola de tareas'}
            </h3>
            <p className="text-sm text-stone-600">
              {phase === 'round1'
                ? 'Selecciona una tarea y asigna la persona más adecuada.'
                : 'Ajusta el plan con fatiga acumulada y nuevas exigencias.'}
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold uppercase tracking-wide">
              <span className={`px-2 py-1 rounded-full border ${selectedTask ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-cyan-600 text-white border-cyan-600'}`}>
                1. Selecciona tarea
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              <span className={`px-2 py-1 rounded-full border ${selectedTask ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>
                2. Asigna persona
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="bg-stone-50 border border-stone-200 rounded-full px-3 py-1 text-xs font-semibold text-stone-700">
              Reasignaciones: {reassignments}
            </div>
            <div className="bg-red-50 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold text-red-600">
              Alertas de carga: {overloadWarnings}
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                incidentPressure >= 30
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : incidentPressure >= 15
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-cyan-50 border-cyan-200 text-cyan-700'
              }`}
            >
              Presion: {incidentPressure}
            </div>
          </div>
        </div>

        {actionFeedback ? (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium animate-fade-in ${feedbackToneClass[actionFeedback.tone]}`}>
            {actionFeedback.message}
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1.04fr_0.96fr] gap-4 items-start">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-2">
            <div>
              <h4 className="font-bold text-stone-700">
                Tareas ({Object.keys(activeAssignments).length}/{activeTasks.length})
              </h4>
              <span className="text-[11px] text-stone-500">{pendingTasksCount} pendientes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-stone-500">{selectedTask ? 'Asignar persona' : 'Selecciona una tarea'}</span>
              <button
                onClick={() => setShowAssignedTasks((value) => !value)}
                className="text-[11px] text-cyan-700 hover:text-cyan-800 font-semibold"
              >
                {showAssignedTasks ? 'Ocultar asignadas' : 'Ver asignadas'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {visibleTasks.map((task) => {
              const assignedId = activeAssignments[task.id];
              const assignedMember = assignedId ? memberById[assignedId] : null;
              const isAssigned = Boolean(assignedId);
              const priorityLabel = task.criticality === 3 ? 'Prioridad alta' : task.criticality === 2 ? 'Prioridad media' : 'Prioridad base';

              return (
                <div key={task.id} className="relative group">
                  <button
                    onClick={() => setSelectedTask(task.id)}
                    className={`w-full p-3 text-left rounded-lg border transition-all ${
                      selectedTask === task.id
                        ? 'bg-cyan-50 border-cyan-500 ring-1 ring-cyan-500 shadow-sm'
                        : isAssigned
                          ? 'bg-stone-50 border-stone-200'
                          : 'bg-white border-stone-200 hover:border-cyan-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-stone-800">{task.name}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded text-[11px] font-bold text-stone-600">
                          <Zap className="w-3 h-3 text-yellow-500" /> +{task.cost}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-semibold">{priorityLabel}</span>
                      {assignedMember ? (
                        <span className="text-[10px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded font-semibold">
                          {assignedMember.name}
                        </span>
                      ) : null}
                    </div>
                  </button>

                  {isAssigned ? (
                    <button
                      onClick={(event) => handleUnassign(task.id, event)}
                      className="absolute -right-2 -top-2 bg-red-100 text-red-500 rounded-full px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-red-200 text-xs"
                      title="Desasignar"
                    >
                      x
                    </button>
                  ) : null}
                </div>
              );
            })}
            {!visibleTasks.length ? (
              <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
                No hay tareas pendientes visibles. Puedes mostrar las asignadas para revisar ajustes.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-4 space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-2">
            <h4 className="font-bold text-stone-700">Equipo</h4>
            {!selectedTask ? (
              <span className="text-[11px] text-stone-500">Paso 1: selecciona tarea</span>
            ) : (
              <button
                onClick={() => setShowTeamDetails((value) => !value)}
                className="text-[11px] text-cyan-700 hover:text-cyan-800 font-semibold"
              >
                {showTeamDetails ? 'Ocultar detalle' : 'Ver detalle'}
              </button>
            )}
          </div>

          {!selectedTaskDef ? (
            <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
              Elige una tarea para comparar capacidad y asignarla al miembro más conveniente.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-700">Tarea activa</div>
                <p className="text-sm font-semibold text-cyan-900">{selectedTaskDef.name}</p>
                <p className="text-xs text-cyan-800 mt-1">{selectedTaskDef.narrative}</p>
              </div>

              <div className="space-y-2">
                {members.map((member) => {
                  const currentLoad = getLoad(activeRoundId, member.id, activeAssignments, activeTasks);
                  const selectedTaskCost = selectedTaskDef.cost;
                  const selectedAlreadyOnMember = activeAssignments[selectedTaskDef.id] === member.id;
                  const previewLoad = currentLoad + (!selectedAlreadyOnMember ? selectedTaskCost : 0);
                  const overload = previewLoad > 110;
                  const warning = previewLoad > 102;
                  return (
                    <button
                      key={member.id}
                      onClick={() => handleAssign(member.id)}
                      className="w-full p-3 bg-white border rounded-lg transition-all shadow-sm text-left hover:border-cyan-300"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-800">{member.name}</div>
                          {showTeamDetails ? (
                            <p className="text-[11px] text-stone-500 leading-snug mt-0.5">{member.strength}</p>
                          ) : null}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold ${currentLoad > 102 ? 'text-red-500' : 'text-stone-500'}`}>{currentLoad}%</div>
                        </div>
                      </div>

                      <div className="mt-2 w-full h-2.5 bg-stone-100 rounded-full overflow-hidden relative border border-stone-200">
                        <div
                          className={`h-full transition-all duration-300 ${currentLoad > 102 ? 'bg-red-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.min(100, currentLoad)}%` }}
                        />
                        {!selectedAlreadyOnMember ? (
                          <div
                            className={`absolute top-0 h-full opacity-60 ${overload ? 'bg-red-600' : 'bg-yellow-400'}`}
                            style={{
                              left: `${Math.min(100, currentLoad)}%`,
                              width: `${Math.min(Math.max(100 - currentLoad, 0), selectedTaskCost)}%`,
                            }}
                          />
                        ) : null}
                      </div>

                      {showTeamDetails
                        ? overload ? (
                            <div className="mt-1 text-[11px] text-red-500 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Sobrecarga
                            </div>
                          ) : warning ? (
                            <div className="mt-1 text-[11px] text-orange-500 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Al límite
                            </div>
                          ) : null
                        : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {allAssignedCurrentRound ? (
        <div className="flex justify-center pt-1">
          {phase === 'round1' ? (
            <Button onClick={proceedToRound2} className="px-12 py-4 text-lg">
              Simular consecuencias (nivel 2) <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={finalize} className="px-12 py-4 text-lg">
              <Award className="w-5 h-5" /> Confirmar plan final
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
};

type CrisisEval = {
  score: number;
  feedback: string;
  suggestion: string;
  dimensions: {
    empathy: number;
    structure: number;
    decisiveness: number;
  };
  evidence: string[];
  confidence: number;
};

const CRISIS_STOP_WORDS = new Set([
  'de',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'y',
  'o',
  'a',
  'en',
  'con',
  'sin',
  'por',
  'para',
  'del',
  'al',
  'que',
  'como',
  'más',
  'menos',
  'muy',
  'se',
  'hay',
  'esta',
  'este',
  'estas',
  'estos',
]);

const normalizeCrisisText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeCrisisText = (value: string) => normalizeCrisisText(value).split(' ').filter((token) => token.length >= 3);

const extractScenarioTokens = (scenario: string) =>
  tokenizeCrisisText(scenario)
    .filter((token) => token.length >= 4 && !CRISIS_STOP_WORDS.has(token))
    .slice(0, 16);

const fallbackCrisisEval = (answer: string, scenario: string): CrisisEval => {
  const normalized = normalizeCrisisText(answer);
  const words = tokenizeCrisisText(answer);
  const answerSet = new Set(words);
  const uniqueWords = answerSet.size;
  const scenarioTokens = extractScenarioTokens(scenario);
  const overlapCount = scenarioTokens.reduce((total, token) => total + (answerSet.has(token) ? 1 : 0), 0);
  const uniqueRatio = words.length ? uniqueWords / words.length : 0;
  const longestToken = words.reduce((longest, token) => (token.length > longest.length ? token : longest), '');
  const vowelRatio = longestToken.length
    ? (longestToken.match(/[aeiouáéíóúü]/g)?.length ?? 0) / longestToken.length
    : 1;
  const gibberishLike =
    /[bcdfghjklmnñpqrstvwxyz]{6,}/i.test(answer) ||
    (longestToken.length >= 8 && vowelRatio < 0.2) ||
    (words.length >= 6 && uniqueRatio < 0.34);

  const empathySignals = ['entiendo', 'lament', 'impacto', 'cliente', 'usuarios', 'equipo', 'disculp', 'afectad'];
  const actionSignals = ['primero', 'segundo', 'luego', 'hoy', 'inmediato', 'acción', 'plan', 'mitigar', 'activo', 'coordino', 'asigno', 'resuelvo', 'informo'];
  const ownershipSignals = ['yo', 'nosotros', 'coordino', 'asigno', 'responsable', 'me hago cargo', 'resuelvo', 'priorizo'];
  const orderSignals = ['primero', 'segundo', 'tercero', 'después', 'luego', 'en paralelo', 'mientras', 'al mismo tiempo'];

  if (answer.trim().length < 8 || words.length < 3 || gibberishLike) {
    return {
      score: 0,
      feedback: gibberishLike
        ? 'La respuesta no es interpretable y no permite evaluar criterio en crisis.'
        : 'La respuesta es demasiado corta para evaluar criterio en crisis.',
      suggestion: 'Incluye al menos 3 acciones concretas: contención, comunicación y seguimiento.',
      dimensions: {
        empathy: 0,
        structure: 0,
        decisiveness: 0,
      },
      evidence: [
        gibberishLike
          ? 'No se pudo extraer una secuencia de acciones ni conexión con el escenario.'
          : 'Respuesta insuficiente para extraer evidencia conductual.',
      ],
      confidence: 0.92,
    };
  }

  const shortAnswer = answer.trim().length < 55 || words.length < 12;
  const repetitiveAnswer = uniqueWords <= Math.max(4, Math.floor(words.length * 0.45));
  const empathyHits = empathySignals.filter((token) => normalized.includes(token)).length;
  const actionHits = actionSignals.filter((token) => normalized.includes(token)).length;
  const ownershipHits = ownershipSignals.filter((token) => normalized.includes(token)).length;
  const orderHits = orderSignals.filter((token) => normalized.includes(token)).length;
  const hasActionSignal = actionHits > 0;
  const hasEmpathySignal = empathyHits > 0;
  const hasOrderSignal = orderHits > 0;

  let empathy = Math.round(
    clamp(
      18 + empathyHits * 14 + Math.min(answer.length / 20, 12),
      0,
      100
    )
  );
  let structure = Math.round(
    clamp(15 + actionHits * 13 + overlapCount * 10, 0, 100)
  );
  let decisiveness = Math.round(
    clamp(14 + ownershipHits * 16 + actionHits * 8, 0, 100)
  );

  if (overlapCount === 0) {
    structure = Math.min(structure, 32);
    decisiveness = Math.min(decisiveness, 34);
  } else if (overlapCount === 1) {
    structure = Math.min(structure, 46);
  }
  if (!hasActionSignal) decisiveness = Math.min(decisiveness, 42);
  if (!hasEmpathySignal) empathy = Math.min(empathy, 42);
  if (!hasOrderSignal) structure = Math.min(structure, 40);

  let score = Math.round(empathy * 0.36 + structure * 0.34 + decisiveness * 0.3);
  if (shortAnswer) score = Math.min(score, 38);
  if (repetitiveAnswer) score = Math.max(0, score - 18);
  if (overlapCount === 0) score = Math.min(score, 8);
  else if (overlapCount === 1) score = Math.min(score, 18);
  if (!hasActionSignal) score = Math.min(score, 20);
  if (!hasOrderSignal) score = Math.min(score, 24);
  if (!hasActionSignal && !hasEmpathySignal) score = Math.min(score, 10);
  if (!hasActionSignal && !hasOrderSignal && overlapCount <= 1) score = Math.min(score, 6);

  const evidence: string[] = [];
  if (overlapCount >= 2) evidence.push('La respuesta se relaciona con el escenario planteado.');
  else evidence.push('La respuesta no conecta con el contexto del incidente.');
  if (empathy >= 55) evidence.push('Reconoce impacto sobre cliente/equipo.');
  if (structure >= 55) evidence.push('Define secuencia de acción con prioridades.');
  if (decisiveness >= 55) evidence.push('Asume ownership y ejecución.');
  if (!hasActionSignal) evidence.push('Falta una acción operativa inmediata.');
  if (!hasOrderSignal) evidence.push('No se explicita un orden de respuesta.');
  if (repetitiveAnswer) evidence.push('Hay baja variedad de ideas en la respuesta.');

  return {
    score: clamp(score, 0, 100),
    feedback:
      overlapCount === 0
        ? 'La respuesta no está conectada con el escenario. Falta contexto para evaluar criterio real.'
        : shortAnswer
          ? 'La respuesta tiene buena intención, pero es corta para validar manejo real de crisis.'
          : 'Respuesta evaluada con rúbrica local de empatía, estructura, ejecución y coherencia contextual.',
    suggestion:
      'Estructura en 3 bloques: 1) contención inmediata, 2) comunicación a stakeholders, 3) plan con tiempos y responsables.',
    dimensions: {
      empathy,
      structure,
      decisiveness,
    },
    evidence: evidence.slice(0, 4),
    confidence: 0.78,
  };
};

const GameProblemSolving = ({
  onComplete,
  track,
  candidateRole,
}: GameProps & { candidateRole: string }) => {
  const [scenario, setScenario] = useState('');
  const [loadingScenario, setLoadingScenario] = useState(true);
  const [answer, setAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<CrisisEval | null>(null);
  const [inputHint, setInputHint] = useState('');

  const firstTypedAt = useRef<number | null>(null);

  const answerStats = useMemo(() => {
    const normalized = normalizeCrisisText(answer);
    const words = tokenizeCrisisText(answer);
    const answerSet = new Set(words);
    const overlapCount = extractScenarioTokens(scenario).reduce((total, token) => total + (answerSet.has(token) ? 1 : 0), 0);
    const longestToken = words.reduce((longest, token) => (token.length > longest.length ? token : longest), '');
    const uniqueRatio = words.length ? answerSet.size / words.length : 0;
    const vowelRatio = longestToken.length
      ? (longestToken.match(/[aeiouáéíóúü]/g)?.length ?? 0) / longestToken.length
      : 1;
    const actionSignal = ['primero', 'plan', 'acción', 'hoy', 'mitigar', 'comunico'].some((token) =>
      normalized.includes(token)
    );
    const orderSignal = ['primero', 'segundo', 'tercero', 'después', 'luego', 'en paralelo', 'mientras'].some(
      (token) => normalized.includes(token)
    );
    const empathySignal = ['cliente', 'equipo', 'impacto', 'disculp', 'entiendo'].some((token) =>
      normalized.includes(token)
    );
    const gibberishLike =
      /[bcdfghjklmnñpqrstvwxyz]{6,}/i.test(answer) ||
      (longestToken.length >= 8 && vowelRatio < 0.2) ||
      (words.length >= 6 && uniqueRatio < 0.34);

    return {
      charCount: answer.trim().length,
      wordCount: words.length,
      overlapCount,
      uniqueRatio,
      hasActionSignal: actionSignal,
      hasOrderSignal: orderSignal,
      hasEmpathySignal: empathySignal,
      hasScenarioSignal: overlapCount >= 2,
      gibberishLike,
    };
  }, [answer, scenario]);

  const loadScenario = useCallback(async () => {
    setLoadingScenario(true);
    try {
      const response = await fetch(`/api/evaluate-crisis?task=scenario&nonce=${Date.now()}`, { cache: 'no-store' });
      const data = (await response.json()) as { scenario?: string };
      setScenario(
        data.scenario ||
          'El sistema de pagos cae durante una campaña alta y clientes reportan cobros duplicados en redes.'
      );
    } catch {
      setScenario('El sistema de pagos cae durante una campaña alta y clientes reportan cobros duplicados en redes.');
    } finally {
      setLoadingScenario(false);
    }
  }, []);

  useEffect(() => {
    void loadScenario();
  }, [loadScenario]);

  const minimumChars = 55;
  const minimumWords = 10;
  const canSubmit =
    !isEvaluating &&
    !loadingScenario &&
    answerStats.charCount >= minimumChars &&
    answerStats.wordCount >= minimumWords &&
    !answerStats.gibberishLike;
  const normalizeEval = (evalData: CrisisEval): CrisisEval => ({
    ...evalData,
    score: Math.round(evalData.score),
    dimensions: {
      empathy: Math.round(evalData.dimensions.empathy),
      structure: Math.round(evalData.dimensions.structure),
      decisiveness: Math.round(evalData.dimensions.decisiveness),
    },
    confidence: Number(evalData.confidence.toFixed(2)),
  });

  const submit = async () => {
    if (!answer.trim() || isEvaluating || loadingScenario) return;
    if (answerStats.charCount < minimumChars) {
      setInputHint(`Necesitas al menos ${minimumChars} caracteres con acciones concretas.`);
      return;
    }
    if (answerStats.wordCount < minimumWords) {
      setInputHint(`Necesitas al menos ${minimumWords} palabras para describir tu plan.`);
      return;
    }
    if (answerStats.gibberishLike) {
      setResult(
        normalizeEval({
          score: 0,
          feedback: 'La respuesta no es interpretable y no permite evaluar criterio en crisis.',
          suggestion: 'Describe en lenguaje simple qué harías primero, cómo comunicarías y qué seguimiento harías.',
          dimensions: {
            empathy: 0,
            structure: 0,
            decisiveness: 0,
          },
          evidence: ['No se identificó una secuencia comprensible de acciones.'],
          confidence: 0.96,
        })
      );
      setInputHint('');
      return;
    }

    const writingTimeMs = firstTypedAt.current ? Date.now() - firstTypedAt.current : 0;
    setIsEvaluating(true);
    setInputHint('');

    track('decision_made', {
      answerChars: answer.trim().length,
      answerWords: answerStats.wordCount,
      hasActionSignal: answerStats.hasActionSignal,
      hasEmpathySignal: answerStats.hasEmpathySignal,
      hasScenarioSignal: answerStats.hasScenarioSignal,
      writingTimeMs,
    });

    try {
      const response = await fetch('/api/evaluate-crisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'evaluate',
          scenario,
          answer,
          role: candidateRole,
          writingTimeMs,
        }),
      });

      if (!response.ok) throw new Error('evaluation_error');
      const data = normalizeEval((await response.json()) as CrisisEval);
      if (answerStats.charCount < 65 && data.score > 48) {
        setResult({
          ...data,
          score: 48,
          feedback: 'La respuesta fue breve; se ajustó el puntaje por baja evidencia conductual.',
        });
      } else if (answerStats.overlapCount <= 1 && data.score > 24) {
        setResult({
          ...data,
          score: 24,
          feedback: 'La respuesta no conecta suficientemente con el escenario; el puntaje se ajustó por baja coherencia contextual.',
        });
      } else if ((!answerStats.hasActionSignal || !answerStats.hasOrderSignal) && data.score > 38) {
        setResult({
          ...data,
          score: 38,
          feedback: 'La respuesta no describe un plan operativo claro; el puntaje se ajustó por baja ejecutabilidad.',
        });
      } else {
        setResult(data);
      }
    } catch {
      setResult(normalizeEval(fallbackCrisisEval(answer, scenario)));
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in pt-8 px-4">
      <Card className="border-l-4 border-l-cyan-500 bg-stone-50">
        <h3 className="text-sm font-bold text-cyan-700 mb-2 uppercase tracking-wide flex items-center gap-2">Escenario entrante</h3>
        {loadingScenario ? (
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        ) : (
          <p className="text-xl text-stone-800 font-serif italic leading-relaxed">"{scenario}"</p>
        )}
      </Card>

      {!result ? (
        <div className="space-y-4">
          <textarea
            value={answer}
            onChange={(event) => {
              if (!firstTypedAt.current) firstTypedAt.current = Date.now();
              setAnswer(event.target.value);
            }}
            placeholder="Escribe tu respuesta inmediata: qué dices, qué haces y en qué orden."
            className="w-full h-44 bg-white border border-stone-300 rounded-xl p-4 text-stone-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all outline-none resize-none shadow-sm text-base"
            disabled={isEvaluating}
          />
          <div className="flex justify-between items-center text-xs text-stone-400">
            <span>Usa enfoque: impacto, acción inmediata, comunicación y seguimiento.</span>
            <span>
              {answerStats.charCount} caracteres | {answerStats.wordCount} palabras
            </span>
          </div>
          <div className="grid md:grid-cols-4 gap-2 text-xs">
            <div className={`rounded border px-2 py-1 ${answerStats.charCount >= minimumChars ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Mínimo {minimumChars} caracteres
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.wordCount >= minimumWords ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Al menos {minimumWords} palabras
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.hasActionSignal ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Incluye acción operativa
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.hasOrderSignal ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Ordena la respuesta
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.hasEmpathySignal ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Reconoce impacto humano
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.hasScenarioSignal ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Responde al escenario
            </div>
            <div className={`rounded border px-2 py-1 ${!answerStats.gibberishLike ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              Texto interpretable
            </div>
          </div>
          {inputHint ? <p className="text-xs text-red-500">{inputHint}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} variant="ai" disabled={!canSubmit}>
              {isEvaluating ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" /> Evaluando
                </>
              ) : (
                'Enviar respuesta'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Card className="animate-fade-in border-t-4 border-t-cyan-500">
          <div className="text-center mb-6">
            <div className={`text-6xl font-bold mb-2 ${result.score >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>{result.score}</div>
            <div className="text-stone-400 text-xs uppercase font-bold tracking-widest">Puntaje de eficacia</div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mb-4">
            {(
              [
                ['Empatía', result.dimensions.empathy],
                ['Estructura', result.dimensions.structure],
                ['Decisión', result.dimensions.decisiveness],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="p-3 rounded-lg border border-stone-200 bg-white">
                <div className="text-[11px] uppercase tracking-wide text-stone-400 font-bold">{label}</div>
                <div className="text-2xl font-bold text-cyan-700">{value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
              <h4 className="font-bold text-stone-700 mb-1">Feedback</h4>
              <p className="text-stone-600">{result.feedback}</p>
            </div>
            <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-100">
              <h4 className="font-bold text-cyan-700 mb-1">Mejor enfoque sugerido</h4>
              <p className="text-cyan-800 italic">"{result.suggestion}"</p>
            </div>
            {result.evidence?.length ? (
              <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
                <h4 className="font-bold text-stone-700 mb-2">Evidencia detectada</h4>
                <ul className="space-y-1 text-sm text-stone-600">
                  {result.evidence.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="text-[11px] text-stone-400 uppercase tracking-wide">Confianza del análisis: {Math.round(result.confidence * 100)}%</div>
          </div>

          <Button
            onClick={() => {
              const writingTimeMs = firstTypedAt.current ? Date.now() - firstTypedAt.current : 0;
              onComplete({
                score: result.score,
                metrics: {
                  answer_chars: answerStats.charCount,
                  answer_words: answerStats.wordCount,
                  writing_time_ms: writingTimeMs,
                  empathy: result.dimensions.empathy,
                  structure: result.dimensions.structure,
                  decisiveness: result.dimensions.decisiveness,
                  confidence: result.confidence,
                },
              });
            }}
            className="w-full mt-6"
          >
            Siguiente fase <ChevronRight className="w-4 h-4" />
          </Button>
        </Card>
      )}
    </div>
  );
};

type RiskScoringFunction = 'linear' | 'accelerated' | 'diminishing';
type RiskModelType = 'A' | 'B' | 'C';
type RiskRoundStatus = 'idle' | 'charging' | 'cashed_out' | 'exploded';

const riskCalculateBasePoints = (charge: number, base: number, type: RiskScoringFunction) => {
  const multiplier =
    type === 'linear' ? charge : type === 'accelerated' ? Math.pow(charge, 2) : Math.sqrt(charge);
  return Math.floor(base * multiplier);
};

const riskCheckExplosion = (
  model: RiskModelType,
  params: { a?: number; b?: number; hazardBase?: number; min?: number; max?: number },
  charge: number,
  dtSeconds: number,
  threshold: number,
  random: number
) => {
  if (model === 'A') {
    const a = params.a ?? 0.1;
    const b = params.b ?? 1.8;
    return random < 1 - Math.exp(-(a + b * charge) * dtSeconds);
  }
  if (model === 'B') {
    return charge >= threshold;
  }
  if (model === 'C') {
    const hazardBase = params.hazardBase ?? 0.2;
    return charge >= threshold || random < 1 - Math.exp(-hazardBase * dtSeconds);
  }
  return false;
};

const GameRisk = ({ onComplete, track }: GameProps) => {
  const config = useMemo(
    () => ({
      model: 'B' as RiskModelType,
      scoring: 'linear' as RiskScoringFunction,
      rounds: 10,
      practiceRounds: 3,
      basePoints: 120,
      maxDurationMs: 3400,
      params: {
        A: { a: 0.1, b: 2.0 },
        B: { min: 0.34, max: 0.93 },
        C: { min: 0.4, max: 0.95, hazardBase: 0.2 },
      },
    }),
    []
  );

  const [currentRound, setCurrentRound] = useState(1);
  const [isPractice, setIsPractice] = useState(true);
  const [tutorialAcknowledged, setTutorialAcknowledged] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [charge, setCharge] = useState(0);
  const [roundStatus, setRoundStatus] = useState<RiskRoundStatus>('idle');
  const [earnedThisRound, setEarnedThisRound] = useState(0);
  const [optimalZone, setOptimalZone] = useState({ min: 0, max: 0 });
  const [optimalHit, setOptimalHit] = useState(false);

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const thresholdRef = useRef(1);

  const holdDurationsRef = useRef<number[]>([]);
  const releaseRatiosRef = useRef<number[]>([]);
  const roundPointsRef = useRef<number[]>([]);
  const explosionsRef = useRef(0);
  const optimalHitsRef = useRef(0);
  const totalPointsRef = useRef(0);
  const finishedRef = useRef(false);

  const setupNextRound = useCallback(() => {
    setCharge(0);
    setEarnedThisRound(0);
    setOptimalHit(false);
    setRoundStatus('idle');

    if (config.model === 'B' || config.model === 'C') {
      const modelParams = config.params[config.model];
      let minThreshold = modelParams.min;
      let maxThreshold = modelParams.max;

      if (isPractice) {
        if (currentRound === 1) {
          minThreshold = 0.72;
          maxThreshold = 0.95;
        } else if (currentRound === 2) {
          minThreshold = 0.58;
          maxThreshold = 0.92;
        } else {
          minThreshold = Math.max(modelParams.min, 0.46);
          maxThreshold = modelParams.max;
        }
      }

      thresholdRef.current = minThreshold + Math.random() * (maxThreshold - minThreshold);
    } else {
      thresholdRef.current = 1;
    }

    const zoneWidth = isPractice ? (currentRound === 1 ? 0.18 : currentRound === 2 ? 0.16 : 0.14) : 0.12;
    const min = (isPractice ? 0.24 : 0.3) + Math.random() * 0.55;
    const max = min + zoneWidth;
    setOptimalZone({ min, max });
  }, [config.model, config.params, currentRound, isPractice]);

  const finalizeGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    const maxPossible = config.rounds * config.basePoints * 2;
    const pointScore = clamp(Math.round((totalPointsRef.current / maxPossible) * 100), 0, 100);
    const avgHold = Math.round(avg(holdDurationsRef.current));
    const avgReleaseRatio = Number(avg(releaseRatiosRef.current).toFixed(2));
    const optimalHitRate = Number((optimalHitsRef.current / config.rounds).toFixed(2));
    const normalizedRatios = releaseRatiosRef.current.map((value) => Math.min(value, 1.2));
    const timingDeviation = avg(normalizedRatios.map((value) => Math.abs(value - 0.86)));
    const timingScore = clamp(Math.round(100 - timingDeviation * 170), 0, 100);
    const consistencyScore = clamp(Math.round(100 - stdDev(normalizedRatios) * 140), 0, 100);
    const optimalScore = clamp(Math.round(optimalHitRate * 100), 0, 100);
    let score = clamp(
      Math.round(
        pointScore * 0.48 +
          optimalScore * 0.18 +
          timingScore * 0.19 +
          consistencyScore * 0.15 -
          explosionsRef.current * 7
      ),
      0,
      100
    );

    if (avgReleaseRatio < 0.58) score = Math.min(score, 38);
    if (optimalHitsRef.current === 0) score = Math.min(score, 52);
    if (explosionsRef.current >= 4) score = Math.min(score, 34);

    track('game_submitted', {
      score,
      total_points: totalPointsRef.current,
      explosions: explosionsRef.current,
      optimal_hits: optimalHitsRef.current,
      optimal_hit_rate: optimalHitRate,
      avg_hold_ms: avgHold,
      avg_release_ratio: avgReleaseRatio,
      point_score: pointScore,
      timing_score: timingScore,
      consistency_score: consistencyScore,
    });

    onComplete({
      score,
      metrics: {
        total_points: totalPointsRef.current,
        max_points: maxPossible,
        explosions: explosionsRef.current,
        optimal_hits: optimalHitsRef.current,
        optimal_hit_rate: optimalHitRate,
        avg_hold_ms: avgHold,
        avg_release_ratio: avgReleaseRatio,
        rounds: config.rounds,
        practice_rounds: config.practiceRounds,
      },
    });
  }, [config.basePoints, config.practiceRounds, config.rounds, onComplete, track]);

  const handleExplosion = useCallback(
    (finalCharge: number, didExplode: boolean) => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }

      const holdDuration = Math.round(performance.now() - startTimeRef.current);
      if (!isPractice) {
        holdDurationsRef.current.push(holdDuration);
        releaseRatiosRef.current.push(Number((finalCharge / Math.max(thresholdRef.current, 0.01)).toFixed(3)));
      }

      if (didExplode) {
        if (!isPractice) explosionsRef.current += 1;
        setEarnedThisRound(0);
        setOptimalHit(false);
        setRoundStatus('exploded');
        roundPointsRef.current.push(0);
        track('error_committed', {
          type: 'risk_explosion',
          round: currentRound,
          practice: isPractice,
          threshold: Number(thresholdRef.current.toFixed(3)),
          charge: Number(finalCharge.toFixed(3)),
        });
        return;
      }

      const basePoints = riskCalculateBasePoints(finalCharge, config.basePoints, config.scoring);
      const points = basePoints;
      setEarnedThisRound(points);
      roundPointsRef.current.push(points);
      if (!isPractice) {
        totalPointsRef.current += points;
        setTotalPoints(totalPointsRef.current);
      }
      setRoundStatus('cashed_out');
      track('decision_made', {
        type: 'risk_auto_cash_out',
        round: currentRound,
        practice: isPractice,
        points,
        charge: Number(finalCharge.toFixed(3)),
      });
    },
    [config.basePoints, config.scoring, currentRound, isPractice, track]
  );

  const gameLoop = useCallback(
    (time: number) => {
      if (finishedRef.current) return;
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const elapsedMs = time - startTimeRef.current;
      const dtSeconds = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const exactCharge = Math.min(1, elapsedMs / config.maxDurationMs);
      setCharge(exactCharge);

      const didExplode = riskCheckExplosion(
        config.model,
        config.params[config.model],
        exactCharge,
        dtSeconds,
        thresholdRef.current,
        Math.random()
      );

      if (didExplode || exactCharge >= 1) {
        handleExplosion(exactCharge, didExplode);
      } else {
        requestRef.current = requestAnimationFrame(gameLoop);
      }
    },
    [config.maxDurationMs, config.model, config.params, handleExplosion]
  );

  const startHold = useCallback(
    (event?: React.PointerEvent | KeyboardEvent) => {
      if (event && 'preventDefault' in event) event.preventDefault();
      const needsTutorialAck = isPractice && currentRound === 1 && !tutorialAcknowledged;
      if (finishedRef.current || roundStatus !== 'idle' || needsTutorialAck) return;

      setRoundStatus('charging');
      const now = performance.now();
      startTimeRef.current = now;
      lastTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(gameLoop);

      track('decision_made', { type: 'risk_hold_start', round: currentRound, practice: isPractice });
    },
    [currentRound, gameLoop, isPractice, roundStatus, track, tutorialAcknowledged]
  );

  const releaseHold = useCallback(() => {
    if (roundStatus !== 'charging') return;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    const holdDuration = Math.round(performance.now() - startTimeRef.current);
    if (!isPractice) holdDurationsRef.current.push(holdDuration);

    const currentCharge = charge;
    const basePts = riskCalculateBasePoints(currentCharge, config.basePoints, config.scoring);
    const isOptimal = currentCharge >= optimalZone.min && currentCharge <= optimalZone.max;
    const finalPoints = isOptimal ? basePts * 2 : basePts;

    if (!isPractice) {
      releaseRatiosRef.current.push(Number((currentCharge / Math.max(thresholdRef.current, 0.01)).toFixed(3)));
      if (isOptimal) optimalHitsRef.current += 1;
    }
    roundPointsRef.current.push(finalPoints);

    if (!isPractice) {
      totalPointsRef.current += finalPoints;
      setTotalPoints(totalPointsRef.current);
    }
    setOptimalHit(isOptimal);
    setEarnedThisRound(finalPoints);
    setRoundStatus('cashed_out');

    track('decision_made', {
      type: 'risk_cash_out',
      round: currentRound,
      practice: isPractice,
      charge: Number(currentCharge.toFixed(3)),
      threshold: Number(thresholdRef.current.toFixed(3)),
      optimal_hit: isOptimal,
      points: finalPoints,
      hold_ms: holdDuration,
    });
  }, [charge, config.basePoints, config.scoring, currentRound, isPractice, optimalZone.max, optimalZone.min, roundStatus, track]);

  const nextRound = useCallback(() => {
    if (isPractice) {
      if (currentRound >= config.practiceRounds) {
        setIsPractice(false);
        setCurrentRound(1);
        setCharge(0);
        setEarnedThisRound(0);
        setOptimalHit(false);
        setRoundStatus('idle');
        track('round_completed', { type: 'risk_practice_completed' });
        return;
      }
      setCurrentRound((value) => value + 1);
      return;
    }

    if (currentRound >= config.rounds) {
      finalizeGame();
      return;
    }
    setCurrentRound((value) => value + 1);
  }, [config.practiceRounds, config.rounds, currentRound, finalizeGame, isPractice, track]);

  useEffect(() => {
    setupNextRound();
  }, [currentRound, isPractice, setupNextRound]);

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    const onGlobalPointerUp = () => releaseHold();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        if (roundStatus === 'idle') {
          startHold(event);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        if (roundStatus === 'charging') {
          event.preventDefault();
          releaseHold();
        }
      }
    };

    if (roundStatus === 'charging') {
      window.addEventListener('pointerup', onGlobalPointerUp);
      window.addEventListener('pointercancel', onGlobalPointerUp);
    }
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [releaseHold, roundStatus, startHold]);

  const basePts = riskCalculateBasePoints(charge, config.basePoints, config.scoring);
  const isCharging = roundStatus === 'charging';
  const isOptimal = charge >= optimalZone.min && charge <= optimalZone.max;
  const isDanger = charge > optimalZone.max;
  const potentialPts = isOptimal ? basePts * 2 : basePts;
  const tutorialVisible = isPractice && currentRound === 1 && !tutorialAcknowledged && roundStatus === 'idle';
  const roundTotal = isPractice ? config.practiceRounds : config.rounds;
  const phaseLabel = isPractice ? 'Fase de prueba' : 'Evaluación principal';

  let progressColor = '#cbd5e1';
  if (isCharging) {
    if (isOptimal) progressColor = '#06b6d4';
    else if (isDanger) progressColor = '#ef4444';
    else progressColor = '#67e8f9';
  }

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - charge * circumference;
  const zoneLength = (optimalZone.max - optimalZone.min) * circumference;
  const zoneOffset = -(optimalZone.min * circumference);

  return (
    <div className="w-full max-w-5xl mx-auto pt-8 px-4 relative" data-testid="risk-game">
      {roundStatus === 'exploded' ? <div className="absolute inset-0 z-20 pointer-events-none risk-flash-red-overlay rounded-2xl" /> : null}
      {roundStatus === 'cashed_out' ? <div className="absolute inset-0 z-20 pointer-events-none risk-flash-cyan-overlay rounded-2xl" /> : null}

      <Card className="p-5 md:p-6 relative overflow-hidden" data-testid="risk-card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isPractice ? 'bg-amber-400' : 'bg-cyan-500'}`} />
              <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400">{phaseLabel}</span>
            </div>
            <div className="text-[10px] uppercase font-mono tracking-widest text-stone-400 mb-1">Tolerancia al riesgo</div>
            <div className="text-sm font-semibold text-stone-700">
              Ronda {currentRound} <span className="text-stone-400">/ {roundTotal}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono tracking-widest text-stone-400 mb-1">Puntaje evaluado</div>
            <div className="text-3xl font-light text-stone-800">{totalPoints.toLocaleString()}</div>
          </div>
        </div>

        <div className="risk-fade-in flex flex-col items-center">
          {tutorialVisible ? (
            <div className="w-full max-w-md mb-4 rounded-xl border border-cyan-100 bg-cyan-50/70 p-4 text-left risk-fade-in">
              <div className="text-[10px] uppercase tracking-widest font-mono text-cyan-700 mb-2">Tutorial rápido (1/3)</div>
              <div className="space-y-1.5 text-sm text-cyan-900">
                <p>1. Mantener presionado para cargar.</p>
                <p>2. Soltar antes del límite invisible para asegurar puntos.</p>
                <p>3. Si sueltas dentro del arco destacado, sumas x2.</p>
              </div>
              <button
                onClick={() => setTutorialAcknowledged(true)}
                className="mt-3 h-9 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold uppercase tracking-widest transition-colors"
              >
                Entendido
              </button>
            </div>
          ) : null}

          <div className="h-24 flex items-end justify-center mb-4 w-full">
            {roundStatus === 'idle' ? (
              <div className="text-stone-400 font-light tracking-widest uppercase text-sm">
                {isPractice ? 'Ronda de prueba: calibra tu ritmo' : 'Esperando interacción'}
              </div>
            ) : null}

            {isCharging ? (
              <div className="flex flex-col items-center">
                <div
                  className={`text-6xl font-extralight tracking-tighter transition-colors duration-100 ${
                    isOptimal ? 'text-cyan-600 scale-105 transform' : isDanger ? 'text-red-500' : 'text-stone-800'
                  }`}
                >
                  {potentialPts}
                </div>
                {isOptimal ? (
                  <div className="text-cyan-600/90 text-[10px] font-mono uppercase tracking-widest mt-2 risk-pulse-subtle">
                    Multiplicador óptimo activo
                  </div>
                ) : null}
                {isDanger ? <div className="text-red-500/90 text-[10px] font-mono uppercase tracking-widest mt-2">Riesgo elevado</div> : null}
              </div>
            ) : null}

            {roundStatus === 'cashed_out' ? (
              <div className="text-center risk-fade-in">
                <div className="text-5xl font-light text-cyan-600">+{earnedThisRound}</div>
                <div className="text-stone-500 font-mono text-xs uppercase tracking-widest mt-3">
                  {optimalHit ? 'Zona óptima alcanzada' : 'Carga asegurada'}
                </div>
              </div>
            ) : null}

            {roundStatus === 'exploded' ? (
              <div className="text-center risk-fade-in">
                <div className="text-5xl font-light text-red-500">Fallo</div>
                <div className="text-stone-500 font-mono text-xs uppercase tracking-widest mt-3">Límite excedido</div>
              </div>
            ) : null}
          </div>

          <div className="relative flex items-center justify-center mb-8" style={{ width: '228px', height: '228px' }} data-testid="risk-gauge">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="4.5" fill="none" />

              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={isOptimal && isCharging ? '#06b6d4' : '#bae6fd'}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${zoneLength} ${circumference}`}
                strokeDashoffset={zoneOffset}
                className="transition-all duration-300"
                style={{ opacity: 0.88 }}
              />

              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={progressColor}
                strokeWidth="4.5"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                className="transition-colors duration-100"
              />
            </svg>

            <div
              className="absolute rounded-full flex items-center justify-center flex-col transition-all duration-150"
              style={{
                width: '122px',
                height: '122px',
                backgroundColor: isCharging ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.85)',
                border: `1px solid ${isCharging ? (isOptimal ? '#06b6d4' : isDanger ? '#ef4444' : '#bae6fd') : '#e2e8f0'}`,
              }}
            >
              <span className="text-2xl font-light tracking-wide text-stone-700">
                {(charge * 100).toFixed(0)}
                <span className="text-sm text-stone-400 ml-1">%</span>
              </span>
            </div>
          </div>

          <div className="w-full max-w-xs h-16 flex items-center justify-center relative">
            {roundStatus === 'idle' || roundStatus === 'charging' ? (
              <button
                onPointerDown={startHold}
                className={`
                  w-full h-14 rounded-full font-semibold text-sm tracking-widest uppercase transition-all duration-150 select-none border
                  ${
                    isCharging
                      ? 'bg-cyan-50 border-cyan-200 text-cyan-700 scale-95 risk-pulse-subtle'
                      : 'bg-cyan-600 text-white border-transparent hover:bg-cyan-500'
                  }
                `}
                style={{ touchAction: 'none' }}
                disabled={tutorialVisible}
              >
                {isCharging ? 'Cargando...' : 'Mantener presionado'}
              </button>
            ) : (
              <button
                onClick={nextRound}
                className="w-full h-14 bg-white text-cyan-700 rounded-full font-semibold text-sm hover:bg-cyan-50 transition-colors uppercase tracking-widest border border-cyan-200"
              >
                {isPractice
                  ? currentRound >= config.practiceRounds
                    ? 'Comenzar evaluación'
                    : 'Siguiente prueba'
                  : currentRound >= config.rounds
                    ? 'Ver resultado'
                    : 'Siguiente ronda'}
              </button>
            )}
          </div>

          <p className="text-stone-400 text-xs text-center mt-1">
            {isPractice
              ? 'Las rondas de prueba no suman al puntaje final.'
              : 'Suelta antes del fallo crítico. Consistencia > máximo puntual.'}
          </p>
        </div>
      </Card>

      <style jsx>{`
        @keyframes riskFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes riskPulseSubtle {
          0% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.04);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
        }
        @keyframes riskFlashRed {
          0% {
            background-color: rgba(239, 68, 68, 0.12);
          }
          100% {
            background-color: transparent;
          }
        }
        @keyframes riskFlashCyan {
          0% {
            background-color: rgba(6, 182, 212, 0.13);
          }
          100% {
            background-color: transparent;
          }
        }
        .risk-fade-in {
          animation: riskFadeIn 0.28s ease-out forwards;
        }
        .risk-pulse-subtle {
          animation: riskPulseSubtle 1.4s infinite ease-in-out;
        }
        .risk-flash-red-overlay {
          animation: riskFlashRed 0.38s ease-out forwards;
        }
        .risk-flash-cyan-overlay {
          animation: riskFlashCyan 0.38s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

type Packet = {
  id: number;
  lane: 0 | 1 | 2;
  y: number;
  speed: number;
  processed: boolean;
  fade: number;
  feedback: 'hit' | 'miss' | null;
};

const GameRouting = ({ onComplete, track }: GameProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const processActionRef = useRef<(lane: 0 | 1 | 2, source: 'keyboard' | 'button') => void>(() => {});

  const [hud, setHud] = useState({
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    falseActions: 0,
    time: 45,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = {
      packets: [] as Packet[],
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      falseActions: 0,
      startAt: performance.now(),
      lastSpawnAt: 0,
      time: 45,
      done: false,
      idCounter: 0,
    };

    const colors = ['#ef4444', '#3b82f6', '#22c55e'] as const;
    const targetY = 312;
    let rafId = 0;
    let lastHudUpdate = 0;
    let lastFrame = performance.now();

    const updateHud = () => {
      setHud({
        score: state.score,
        combo: state.combo,
        maxCombo: state.maxCombo,
        hits: state.hits,
        misses: state.misses,
        falseActions: state.falseActions,
        time: state.time,
      });
    };

    const finish = () => {
      if (state.done) return;
      state.done = true;
      const attempts = state.hits + state.misses;
      const accuracy = attempts > 0 ? state.hits / attempts : 0;
      const score = clamp(Math.round((state.score / 320) * 100), 0, 100);

      track('game_submitted', {
        score,
        hits: state.hits,
        misses: state.misses,
        falseActions: state.falseActions,
        accuracy: Number(accuracy.toFixed(2)),
      });

      onComplete({
        score,
        metrics: {
          hits: state.hits,
          misses: state.misses,
          false_actions: state.falseActions,
          max_combo: state.maxCombo,
          accuracy: Number(accuracy.toFixed(2)),
        },
      });
    };

    const processAction = (lane: 0 | 1 | 2, source: 'keyboard' | 'button') => {
      if (state.done) return;

      const candidate = state.packets
        .filter((packet) => !packet.processed && packet.y > 245 && packet.y < 360)
        .sort((a, b) => Math.abs(a.y - targetY) - Math.abs(b.y - targetY))[0];

      if (!candidate) {
        state.combo = 0;
        state.falseActions += 1;
        track('error_committed', { type: 'routing_false_action', lane, source });
        return;
      }

      candidate.processed = true;
      if (candidate.lane === lane) {
        candidate.feedback = 'hit';
        state.hits += 1;
        state.combo += 1;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.score += 10 + state.combo * 2;
        track('decision_made', { lane, source, result: 'hit', combo: state.combo });
      } else {
        candidate.feedback = 'miss';
        state.combo = 0;
        state.misses += 1;
        state.score = Math.max(0, state.score - 6);
        track('error_committed', { type: 'routing_miss', expected: candidate.lane, received: lane, source });
      }
    };

    processActionRef.current = processAction;

    const drawPacketShape = (lane: 0 | 1 | 2) => {
      if (lane === 0) {
        ctx.fillRect(-5, -5, 10, 10);
      } else if (lane === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(6, 4);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();
      }
    };

    const render = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(200, 0, 400, canvas.height);

      ctx.fillStyle = '#ef444455';
      ctx.fillRect(130, targetY + 38, 120, 8);
      ctx.fillStyle = '#3b82f655';
      ctx.fillRect(340, targetY + 38, 120, 8);
      ctx.fillStyle = '#22c55e55';
      ctx.fillRect(550, targetY + 38, 120, 8);

      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(120, targetY);
      ctx.lineTo(680, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px ui-sans-serif';
      ctx.fillText('Presiona <- o v o -> cuando el paquete cruza la linea', 170, 26);

      for (const packet of state.packets) {
        ctx.save();
        ctx.translate(400, packet.y);
        ctx.globalAlpha = packet.fade;

        ctx.shadowBlur = 18;
        ctx.shadowColor = colors[packet.lane];
        ctx.fillStyle = colors[packet.lane];
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        drawPacketShape(packet.lane);

        ctx.restore();
      }

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '24px ui-sans-serif';
      ctx.fillText('<', 185, targetY + 78);
      ctx.fillText('v', 394, targetY + 78);
      ctx.fillText('>', 605, targetY + 78);
    };

    const tick = (now: number) => {
      if (state.done) return;

      const dt = Math.min(32, now - lastFrame);
      lastFrame = now;
      const step = dt / 16.666;

      const elapsed = (now - state.startAt) / 1000;
      state.time = Math.max(0, 45 - Math.floor(elapsed));
      if (state.time <= 0) {
        updateHud();
        finish();
        return;
      }

      const spawnRate = Math.max(520, 1450 - elapsed * 24);
      if (now - state.lastSpawnAt > spawnRate) {
        state.idCounter += 1;
        state.packets.push({
          id: state.idCounter,
          lane: Math.floor(Math.random() * 3) as 0 | 1 | 2,
          y: -20,
          speed: 2.2 + elapsed * 0.05,
          processed: false,
          fade: 1,
          feedback: null,
        });
        state.lastSpawnAt = now;
      }

      for (const packet of state.packets) {
        if (!packet.processed) {
          packet.y += packet.speed * step;
          if (packet.y > canvas.height - 12) {
            packet.processed = true;
            packet.feedback = 'miss';
            state.combo = 0;
            state.misses += 1;
            state.score = Math.max(0, state.score - 4);
            track('error_committed', { type: 'routing_timeout', expected: packet.lane });
          }
        } else {
          packet.fade -= 0.07 * step;
        }
      }

      state.packets = state.packets.filter((packet) => packet.fade > 0);

      if (now - lastHudUpdate > 110) {
        updateHud();
        lastHudUpdate = now;
      }

      render();
      rafId = requestAnimationFrame(tick);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') processAction(0, 'keyboard');
      if (event.key === 'ArrowDown') processAction(1, 'keyboard');
      if (event.key === 'ArrowRight') processAction(2, 'keyboard');
    };

    window.addEventListener('keydown', onKeyDown);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      processActionRef.current = () => {};
    };
  }, [onComplete, track]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto animate-fade-in pt-8 px-4">
      <div className="flex justify-between w-full px-6 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex flex-col">
          <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Tiempo</span>
          <div className={`text-3xl font-mono font-bold ${hud.time < 10 ? 'text-red-500' : 'text-stone-800'}`}>{hud.time}s</div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Combo</span>
          <div className={`text-4xl font-black italic ${hud.combo > 5 ? 'text-cyan-500 scale-110' : 'text-stone-300'}`}>x{hud.combo}</div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Puntaje</span>
          <div className="text-3xl font-mono font-bold text-cyan-600">{hud.score}</div>
        </div>
      </div>

      <div className="w-full rounded-xl overflow-hidden border-4 border-stone-200 shadow-2xl bg-stone-900">
        <canvas ref={canvasRef} width={800} height={420} className="w-full h-auto bg-stone-900" />
      </div>

      <div className="w-full max-w-lg grid grid-cols-3 gap-4">
        <Button variant="danger" className="py-4" onClick={() => processActionRef.current(0, 'button')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Button variant="secondary" className="py-4" onClick={() => processActionRef.current(1, 'button')}>
          <ArrowDown className="w-5 h-5" />
        </Button>
        <Button variant="primary" className="py-4" onClick={() => processActionRef.current(2, 'button')}>
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="text-xs text-stone-500">
        Hits: {hud.hits} | Misses: {hud.misses} | Vacio: {hud.falseActions} | Max combo: {hud.maxCombo}
      </div>
    </div>
  );
};

type NetworkNode = {
  id: string;
  x: number;
  y: number;
  type: 'source' | 'switch' | 'station';
  next?: string;
  options?: string[];
  color?: string;
};

type NetworkPacket = {
  id: string;
  color: string;
  pos: { x: number; y: number };
  targetNode: string;
  prevNode: string;
  progress: number;
  baseSpeed: number;
  angle: number;
  scale: number;
  createdAt: number;
  switchesPassed: number;
};

type NetworkParticle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
};

const NETWORK_NODES: Record<string, NetworkNode> = {
  START: { id: 'START', x: 15, y: 50, next: 'J1', type: 'source' },
  J1: { id: 'J1', x: 30, y: 50, type: 'switch', options: ['J2', 'J3'] },
  J2: { id: 'J2', x: 30, y: 25, type: 'switch', options: ['S_BLUE', 'S_RED'] },
  S_BLUE: { id: 'S_BLUE', x: 10, y: 25, type: 'station', color: '#3b82f6' },
  S_RED: { id: 'S_RED', x: 55, y: 25, type: 'station', color: '#ef4444' },
  J3: { id: 'J3', x: 65, y: 50, type: 'switch', options: ['S_YELLOW', 'J4'] },
  S_YELLOW: { id: 'S_YELLOW', x: 90, y: 50, type: 'station', color: '#eab308' },
  J4: { id: 'J4', x: 65, y: 75, type: 'switch', options: ['S_GREEN', 'S_PURPLE'] },
  S_GREEN: { id: 'S_GREEN', x: 40, y: 75, type: 'station', color: '#22c55e' },
  S_PURPLE: { id: 'S_PURPLE', x: 90, y: 75, type: 'station', color: '#a855f7' },
};

const NETWORK_FLOW_COLORS = ['#3b82f6', '#ef4444', '#eab308', '#22c55e', '#a855f7'];
const NETWORK_SWITCH_IDS = Object.values(NETWORK_NODES)
  .filter((node) => node.type === 'switch')
  .map((node) => node.id);

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

const GameNetwork = ({ onComplete, track }: GameProps) => {
  const [gameState, setGameState] = useState<'playing' | 'finished'>('playing');
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [peakParallel, setPeakParallel] = useState(0);
  const [uiSwitches, setUiSwitches] = useState<Record<string, number>>({});
  const [uiPackets, setUiPackets] = useState<NetworkPacket[]>([]);
  const [uiParticles, setUiParticles] = useState<NetworkParticle[]>([]);

  const switchesRef = useRef<Record<string, number>>({});
  const packetsRef = useRef<NetworkPacket[]>([]);
  const particlesRef = useRef<NetworkParticle[]>([]);
  const scoreRef = useRef(0);
  const routedRef = useRef(0);
  const missedRef = useRef(0);
  const switchFlipsRef = useRef(0);
  const timelySwitchesRef = useRef(0);
  const proactiveSwitchesRef = useRef(0);
  const peakParallelRef = useRef(0);
  const finishedRef = useRef(false);
  const timeLeftRef = useRef(60);
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef({ lastRafTs: 0, simNowMs: 0, lastSpawnMs: 0, nextUiSyncMs: 0 });
  const stepSimulationRef = useRef<(deltaMs: number) => void>(() => {});

  const calculateAngleByIds = useCallback((fromId: string, toId: string) => {
    const from = NETWORK_NODES[fromId];
    const to = NETWORK_NODES[toId];
    if (!from || !to) return 0;
    return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, color: string, count = 6, spread = 0.045) => {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * spread + 0.02;
      particlesRef.current.push({
        id: `prt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.0017 + Math.random() * 0.0008,
        color,
        size: 0.45 + Math.random() * 1.5,
      });
    }
  }, []);

  const syncUi = useCallback(() => {
    setUiPackets([...packetsRef.current]);
    setUiParticles([...particlesRef.current]);
    setScore(scoreRef.current);
    setMistakes(missedRef.current);
    setPeakParallel(peakParallelRef.current);
    setLevel(clamp(Math.floor(scoreRef.current / 5) + 1, 1, 6));
  }, []);

  const finalizeGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setGameState('finished');

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const correctRoutes = routedRef.current;
    const wrongRoutes = missedRef.current;
    const totalRoutes = correctRoutes + wrongRoutes;
    const accuracy = totalRoutes > 0 ? correctRoutes / totalRoutes : 0;

    const activityScore = clamp(Math.round((totalRoutes / 16) * 100), 0, 100);
    const throughputScore = clamp(Math.round((correctRoutes / 20) * 100), 0, 100);
    const accuracyScore = clamp(Math.round(accuracy * 100), 0, 100);
    const multitaskScore = clamp(Math.round((peakParallelRef.current / 5) * 100), 0, 100);
    const switchQualityScore =
      switchFlipsRef.current > 0
        ? clamp(Math.round((timelySwitchesRef.current / switchFlipsRef.current) * 100), 0, 100)
        : 0;

    let finalScore = clamp(
      Math.round(
        throughputScore * 0.28 +
          accuracyScore * 0.32 +
          multitaskScore * 0.14 +
          switchQualityScore * 0.16 +
          activityScore * 0.1
      ),
      0,
      100
    );

    if (totalRoutes < 6) finalScore = Math.min(finalScore, 22);
    else if (totalRoutes < 10) finalScore = Math.min(finalScore, 40);
    if (correctRoutes < 5) finalScore = Math.min(finalScore, 28);
    if (accuracy < 0.5) finalScore = Math.min(finalScore, 36);
    if (switchFlipsRef.current < 2) finalScore = Math.min(finalScore, 30);

    track('game_submitted', {
      finalScore,
      correctRoutes,
      wrongRoutes,
      accuracy: Number(accuracy.toFixed(2)),
      activityScore,
      switchFlips: switchFlipsRef.current,
      timelySwitches: timelySwitchesRef.current,
      proactiveSwitches: proactiveSwitchesRef.current,
      peakParallel: peakParallelRef.current,
    });

    onComplete({
      score: finalScore,
      metrics: {
        correct_routes: correctRoutes,
        wrong_routes: wrongRoutes,
        accuracy: Number(accuracy.toFixed(2)),
        switch_flips: switchFlipsRef.current,
        timely_switches: timelySwitchesRef.current,
        proactive_switches: proactiveSwitchesRef.current,
        peak_parallel_packets: peakParallelRef.current,
        throughput_per_min: correctRoutes,
      },
    });
  }, [onComplete, track]);

  const stepSimulation = useCallback(
    (deltaMs: number) => {
      if (finishedRef.current) return;
      const frame = frameRef.current;
      frame.simNowMs += deltaMs;

      const nextTime = Math.max(0, 60 - Math.floor(frame.simNowMs / 1000));
      if (nextTime !== timeLeftRef.current) {
        timeLeftRef.current = nextTime;
        setTimeLeft(nextTime);
        if (nextTime === 0) {
          syncUi();
          finalizeGame();
          return;
        }
      }

      const currentLevel = clamp(Math.floor(scoreRef.current / 5) + 1, 1, 6);
      const speedMultiplier = currentLevel >= 5 ? 1.62 : currentLevel >= 3 ? 1.32 : 1;
      const spawnIntervalMs = Math.max(780, 2500 - currentLevel * 290);
      const maxConcurrentPackets = Math.min(7, 2 + Math.floor(currentLevel / 2));

      if (
        frame.simNowMs - frame.lastSpawnMs >= spawnIntervalMs &&
        packetsRef.current.length < maxConcurrentPackets
      ) {
        const color = NETWORK_FLOW_COLORS[Math.floor(Math.random() * NETWORK_FLOW_COLORS.length)];
        const startNode = NETWORK_NODES.START;
        const nextNodeId = startNode.next || 'J1';
        packetsRef.current.push({
          id: `pkt-${frame.simNowMs}-${Math.random().toString(16).slice(2)}`,
          color,
          pos: { x: startNode.x, y: startNode.y },
          targetNode: nextNodeId,
          prevNode: 'START',
          progress: 0,
          baseSpeed: (0.00039 + currentLevel * 0.00005) * speedMultiplier,
          angle: calculateAngleByIds('START', nextNodeId),
          scale: 0,
          createdAt: frame.simNowMs,
          switchesPassed: 0,
        });
        frame.lastSpawnMs = frame.simNowMs;
      }

      const updatedPackets: NetworkPacket[] = [];
      for (const packet of packetsRef.current) {
        const target = NETWORK_NODES[packet.targetNode];
        const prev = NETWORK_NODES[packet.prevNode];
        if (!target || !prev) continue;

        packet.progress += packet.baseSpeed * deltaMs;
        packet.scale = Math.min(1, packet.scale + 0.04);
        packet.pos.x = prev.x + (target.x - prev.x) * packet.progress;
        packet.pos.y = prev.y + (target.y - prev.y) * packet.progress;

        if (packet.progress >= 1) {
          if (target.type === 'station') {
            if (packet.color === target.color) {
              scoreRef.current += 1;
              routedRef.current += 1;
              spawnParticles(target.x, target.y, target.color || '#06b6d4', 10, 0.05);
            } else {
              missedRef.current += 1;
              track('error_committed', {
                type: 'network_wrong_station',
                packetColor: packet.color,
                stationColor: target.color,
              });
            }
            continue;
          }

          const nextNodeId =
            target.type === 'switch'
              ? target.options?.[switchesRef.current[target.id] ?? 0]
              : target.next;
          if (!nextNodeId || !NETWORK_NODES[nextNodeId]) continue;

          packet.prevNode = target.id;
          packet.targetNode = nextNodeId;
          packet.progress = 0;
          packet.angle = calculateAngleByIds(target.id, nextNodeId);
          if (target.type === 'switch') packet.switchesPassed += 1;
        }
        updatedPackets.push(packet);
      }
      packetsRef.current = updatedPackets;

      const updatedParticles: NetworkParticle[] = [];
      for (const particle of particlesRef.current) {
        particle.x += particle.vx * deltaMs;
        particle.y += particle.vy * deltaMs;
        particle.life -= particle.decay * deltaMs;
        if (particle.life > 0) updatedParticles.push(particle);
      }
      particlesRef.current = updatedParticles;

      peakParallelRef.current = Math.max(peakParallelRef.current, packetsRef.current.length);

      if (frame.simNowMs >= frame.nextUiSyncMs) {
        syncUi();
        frame.nextUiSyncMs = frame.simNowMs + 32;
      }
    },
    [calculateAngleByIds, finalizeGame, spawnParticles, syncUi, track]
  );

  useEffect(() => {
    stepSimulationRef.current = stepSimulation;
  }, [stepSimulation]);

  useEffect(() => {
    const initialSwitches: Record<string, number> = {};
    for (const switchId of NETWORK_SWITCH_IDS) initialSwitches[switchId] = 0;
    switchesRef.current = initialSwitches;
    setUiSwitches(initialSwitches);
    setUiPackets([]);
    setUiParticles([]);
    finishedRef.current = false;
    setGameState('playing');
    scoreRef.current = 0;
    routedRef.current = 0;
    missedRef.current = 0;
    switchFlipsRef.current = 0;
    timelySwitchesRef.current = 0;
    proactiveSwitchesRef.current = 0;
    peakParallelRef.current = 0;
    particlesRef.current = [];
    frameRef.current = { lastRafTs: 0, simNowMs: 0, lastSpawnMs: 0, nextUiSyncMs: 0 };
    timeLeftRef.current = 60;
    setTimeLeft(60);

    const animate = (ts: number) => {
      if (finishedRef.current) return;
      const frame = frameRef.current;
      if (!frame.lastRafTs) frame.lastRafTs = ts;
      const deltaMs = Math.min(64, ts - frame.lastRafTs);
      frame.lastRafTs = ts;
      stepSimulationRef.current(deltaMs);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify({
        mode: gameState,
        coordinate_system: {
          origin: 'top-left',
          x: 'right+',
          y: 'down+',
          units: 'svg percent (0-100)',
        },
        timeLeft,
        score: scoreRef.current,
        level: clamp(Math.floor(scoreRef.current / 5) + 1, 1, 6),
        switches: switchesRef.current,
        particles: particlesRef.current.length,
        packets: packetsRef.current.slice(0, 10).map((packet) => ({
          id: packet.id,
          color: packet.color,
          x: Number(packet.pos.x.toFixed(2)),
          y: Number(packet.pos.y.toFixed(2)),
          from: packet.prevNode,
          to: packet.targetNode,
          progress: Number(packet.progress.toFixed(2)),
        })),
      });

    window.advanceTime = (ms: number) => {
      const stepMs = 1000 / 60;
      const steps = Math.max(1, Math.round(ms / stepMs));
      for (let i = 0; i < steps; i += 1) stepSimulationRef.current(stepMs);
      syncUi();
    };

    return () => {
      window.render_game_to_text = undefined;
      window.advanceTime = undefined;
    };
  }, [gameState, timeLeft, syncUi]);

  const toggleSwitch = (switchId: string) => {
    if (gameState !== 'playing' || finishedRef.current) return;
    const node = NETWORK_NODES[switchId];
    if (!node || !node.options || !node.options.length) return;

    const currentIndex = switchesRef.current[switchId] ?? 0;
    const nextIndex = (currentIndex + 1) % node.options.length;
    switchesRef.current[switchId] = nextIndex;
    setUiSwitches({ ...switchesRef.current });

    switchFlipsRef.current += 1;
    const incoming = packetsRef.current
      .filter((packet) => packet.targetNode === switchId)
      .sort((a, b) => b.progress - a.progress)[0];

    if (incoming && incoming.progress >= 0.55) {
      timelySwitchesRef.current += 1;
      track('decision_made', {
        type: 'network_switch_flip_timed',
        switchId,
        packetProgress: Number(incoming.progress.toFixed(2)),
      });
    } else {
      proactiveSwitchesRef.current += 1;
      track('decision_made', { type: 'network_switch_flip_proactive', switchId });
    }
  };

  const networkPaceLabel = level >= 5 ? 'MAXIMO' : level >= 3 ? 'ALTO' : 'NORMAL';

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-6xl mx-auto animate-fade-in pt-4 px-4" data-testid="network-game">
      <div className="flex justify-between w-full px-5 py-3 bg-white rounded-xl border border-stone-200 shadow-sm gap-4" data-testid="network-hud">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Tiempo</span>
            <div className={`text-2xl font-mono font-bold ${timeLeft < 10 ? 'text-red-500' : 'text-stone-800'}`}>
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Sincronizados</span>
            <div className="text-2xl font-mono font-bold text-cyan-600">{score}</div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Nivel</span>
            <div className="text-4xl font-black italic leading-none text-stone-600">{networkPaceLabel}</div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Fase actual</span>
          <div className="text-5xl font-black italic leading-none text-stone-300">05</div>
        </div>
      </div>

      <Card className="w-full max-w-[1080px] mx-auto relative aspect-[16/9] overflow-hidden p-0 rounded-3xl border-2 border-stone-200 bg-white shadow-lg" data-testid="network-board">
        <div className="absolute top-4 left-4 bg-white/92 backdrop-blur p-3 rounded-2xl text-xs text-stone-500 border border-stone-200 z-10 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Disc className="w-4 h-4 text-cyan-600" />
            <span className="font-bold text-stone-700">Control de Flujo</span>
          </div>
          Haz clic en los nodos para redirigir.
        </div>

        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
          <defs>
            <filter id="networkSoftShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.15" />
            </filter>
            <filter id="networkGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="networkBoardBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fafaf9" />
              <stop offset="100%" stopColor="#f5f5f4" />
            </linearGradient>
          </defs>

          <rect width="100" height="100" fill="url(#networkBoardBg)" />

          {Object.entries(NETWORK_NODES).map(([id, node]) => {
            const targets = node.options || (node.next ? [node.next] : []);
            return targets.map((targetId) => {
              const targetNode = NETWORK_NODES[targetId];
              if (!targetNode) return null;
              const isActive =
                node.type === 'source' ||
                (node.type === 'switch' && node.options?.[uiSwitches[id] ?? 0] === targetId);

              return (
                <g key={`network-path-${id}-${targetId}`}>
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="#e5e7eb"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="white"
                    strokeOpacity="0.45"
                    strokeWidth="0.55"
                    strokeLinecap="round"
                  />
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={isActive ? '#22d3ee' : 'transparent'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="transition-colors duration-300"
                    filter={isActive ? 'url(#networkGlow)' : undefined}
                  />
                </g>
              );
            });
          })}

          <g transform={`translate(${NETWORK_NODES.START.x}, ${NETWORK_NODES.START.y})`}>
            <circle r="5" fill="#f5f5f4" stroke="#d6d3d1" strokeWidth="1" filter="url(#networkSoftShadow)" />
            <circle r="3" fill="white" stroke="#78716c" strokeWidth="0.5" />
            <circle r="1.8" fill="#06b6d4" className="animate-pulse" filter="url(#networkGlow)" />
          </g>

          {Object.values(NETWORK_NODES)
            .filter((node) => node.type === 'station')
            .map((station) => (
              <g key={station.id} transform={`translate(${station.x}, ${station.y})`}>
                <circle r="3.5" fill="white" stroke="#e5e7eb" strokeWidth="1" filter="url(#networkSoftShadow)" />
                <circle r="2.2" fill={station.color} />
                <circle
                  r="5"
                  stroke={station.color}
                  strokeWidth="0.5"
                  strokeOpacity="0.45"
                  fill="none"
                  className="animate-pulse"
                />
              </g>
            ))}

          {Object.values(NETWORK_NODES)
            .filter((node) => node.type === 'switch')
            .map((sw) => {
              const options = sw.options || [];
              const targetId = options[uiSwitches[sw.id] ?? 0];
              const target = NETWORK_NODES[targetId];
              const angle = target ? calculateAngleByIds(sw.id, target.id) : 0;

              return (
                <g
                  key={sw.id}
                  transform={`translate(${sw.x}, ${sw.y})`}
                  className="cursor-pointer"
                  onPointerDown={() => toggleSwitch(sw.id)}
                >
                  <circle r="6" fill="transparent" />
                  <circle
                    r="3.5"
                    fill="white"
                    stroke="#78716c"
                    strokeWidth="0.6"
                    className="transition-colors"
                    filter="url(#networkSoftShadow)"
                  />
                  <path
                    d="M-1.2,0 L1.2,0 L0.4,-0.8 M1.2,0 L0.4,0.8"
                    stroke="#57534e"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    transform={`rotate(${angle})`}
                    className="transition-colors"
                  />
                </g>
              );
            })}

          {uiParticles.map((particle) => (
            <circle
              key={particle.id}
              cx={particle.x}
              cy={particle.y}
              r={particle.size}
              fill={particle.color}
              opacity={particle.life}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {uiPackets.map((packet) => (
            <g key={packet.id} transform={`translate(${packet.pos.x}, ${packet.pos.y}) scale(${packet.scale})`}>
              <circle r="2.5" fill={packet.color} opacity="0.3" />
              <circle r="1.5" fill={packet.color} stroke="white" strokeWidth="0.8" filter="url(#networkGlow)" />
            </g>
          ))}
        </svg>
      </Card>
    </div>
  );
};

const GameStrategy = ({
  onComplete,
  track,
  setStrategyProfile,
}: GameProps & { setStrategyProfile: (profile: string) => void }) => {
  const [allocations, setAllocations] = useState<AllocationMap>({
    ops: 0,
    staff: 0,
    data: 0,
    rd: 0,
  });
  const [adjustments, setAdjustments] = useState(0);

  const categories: Array<{
    id: AllocationKey;
    label: string;
    desc: string;
    color: string;
    ideal: number;
  }> = [
    { id: 'ops', label: 'Operaciones', desc: 'Resultados de corto plazo', color: 'bg-blue-500', ideal: 30 },
    { id: 'staff', label: 'Equipo', desc: 'Retencion y salud cultural', color: 'bg-green-500', ideal: 25 },
    { id: 'data', label: 'Seguridad', desc: 'Riesgo y cumplimiento', color: 'bg-red-500', ideal: 30 },
    { id: 'rd', label: 'I+D', desc: 'Ventaja futura', color: 'bg-purple-500', ideal: 15 },
  ];

  const remaining = 100 - Object.values(allocations).reduce((sum, value) => sum + value, 0);

  const handleSlide = (id: AllocationKey, value: number) => {
    const current = allocations[id];
    const delta = value - current;
    if (remaining - delta < 0) return;

    const nextSnapshot: AllocationMap = { ...allocations, [id]: value };
    setAllocations(nextSnapshot);
    setAdjustments((count) => count + 1);
    track('decision_made', { area: id, value, snapshot: nextSnapshot });
  };

  const finish = () => {
    const ideal = categories.reduce((acc, item) => {
      acc[item.id] = item.ideal;
      return acc;
    }, {} as AllocationMap);

    const distance = (Object.keys(allocations) as AllocationKey[]).reduce(
      (sum, key) => sum + Math.abs(allocations[key] - ideal[key]),
      0
    );

    const maxEntry = (Object.entries(allocations) as Array<[AllocationKey, number]>).reduce((best, current) =>
      current[1] > best[1] ? current : best
    );

    const allocationValues = Object.values(allocations) as number[];
    const spread = stdDev(allocationValues);
    const zeroBuckets = allocationValues.filter((value) => value === 0).length;
    const lowBuckets = allocationValues.filter((value) => value < 10).length;
    const concentrationPenalty = maxEntry[1] > 45 ? Math.round((maxEntry[1] - 45) * 1.35) : 0;
    const underDiversificationPenalty = zeroBuckets * 8 + lowBuckets * 3;
    const diversificationBonus = allocationValues.every((value) => value >= 10) ? 4 : 0;
    const adjustmentPenalty = adjustments > 18 ? Math.min(8, Math.round((adjustments - 18) / 2)) : 0;

    let score = clamp(
      Math.round(
        100 -
          distance * 0.68 -
          spread * 0.55 -
          concentrationPenalty -
          underDiversificationPenalty -
          adjustmentPenalty +
          diversificationBonus
      ),
      0,
      100
    );

    if (maxEntry[1] >= 70) score = Math.min(score, 35);
    else if (maxEntry[1] >= 60) score = Math.min(score, 50);
    if (distance >= 80) score = Math.min(score, 42);

    const proportions = (Object.values(allocations) as number[]).map((value) => value / 100);
    const diversity = Number((entropy(proportions) / 2).toFixed(2));

    setStrategyProfile(maxEntry[0]);

    track('game_submitted', {
      score,
      dominant: maxEntry[0],
      diversity,
      adjustments,
    });

    onComplete({
      score,
      metrics: {
        dominant_focus: maxEntry[0],
        dominant_pct: maxEntry[1],
        diversity_index: diversity,
        adjustments,
        ops: allocations.ops,
        staff: allocations.staff,
        data: allocations.data,
        rd: allocations.rd,
      },
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 animate-fade-in pt-8 px-4">
      <Card className="border-t-4 border-t-cyan-500">
        <h3 className="text-xl font-bold text-stone-800 mb-2">Caso de negocio: Expansion Series B</h3>
        <p className="text-stone-600 leading-relaxed text-sm">
          Cerraste una ronda clave y debes distribuir el 100% del capital para 12 meses. Tu decisión define velocidad, seguridad,
          cultura e innovacion. No hay respuesta unica, pero si trade-offs visibles.
        </p>
      </Card>

      <div className="text-center">
        <h3 className="text-2xl font-bold text-stone-800">Matriz de prioridades</h3>
        <div className={`text-5xl font-bold mt-2 font-mono ${remaining === 0 ? 'text-green-600' : 'text-stone-400'}`}>
          {remaining}% <span className="text-lg font-sans font-normal text-stone-400">capital restante</span>
        </div>
      </div>

      <div className="space-y-5">
        {categories.map((category) => (
          <div key={category.id} className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between mb-4">
              <div>
                <span className="font-bold text-stone-800 block text-lg">{category.label}</span>
                <span className="text-sm text-stone-500">{category.desc}</span>
              </div>
              <span className="font-mono font-bold text-2xl text-cyan-700">{allocations[category.id]}%</span>
            </div>
            <div className="relative pt-2">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={allocations[category.id]}
                onChange={(event) => handleSlide(category.id, Number(event.target.value))}
                className="w-full h-3 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-cyan-600"
              />
              <div className="flex justify-between text-xs text-stone-400 mt-2 font-mono">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center pb-12">
        <Button onClick={finish} disabled={remaining > 0} className="w-full md:w-auto px-16 py-4 text-lg">
          {remaining > 0 ? 'Asigna todo el capital' : 'Confirmar estrategia'}
        </Button>
      </div>
    </div>
  );
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

type SignalTone = 'good' | 'warn' | 'risk';

type SignalQualityPack = {
  score: number;
  label: string;
  tone: SignalTone;
  summary: string;
  checks: string[];
};

const DashboardHint = ({ text, testId }: { text: string; testId?: string }) => (
  <span
    title={text}
    data-testid={testId}
    className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-cyan-200 text-cyan-700 bg-cyan-50 cursor-help"
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

const getSignalTone = (score: number): SignalTone => {
  if (score >= 75) return 'good';
  if (score >= 60) return 'warn';
  return 'risk';
};

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

const getStdDev = (values: number[]) => {
  if (!values.length) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const buildSignalQuality = (scores: ScoresMap, metrics: MetricsMap): SignalQualityPack => {
  const performanceScores = PERFORMANCE_GAME_IDS.map((gameId) => toSafeNumber(scores[gameId], 0));
  const completedAssessments = performanceScores.filter((score) => score > 0).length;
  const completeness = Math.round((completedAssessments / PERFORMANCE_GAME_IDS.length) * 100);
  const consistency = clamp(Math.round(100 - getStdDev(performanceScores) * 1.2), 0, 100);

  const leadershipDecisions = toSafeNumber(metrics.leadership.total_assigned, 0);
  const routingActions = toSafeNumber(metrics.network.switch_flips, 0);
  const riskRounds = toSafeNumber(metrics.risk.rounds_played, 0);
  const crisisWords = toSafeNumber(metrics.problemSolving.word_count, 0);
  const behaviorDepth = clamp(
    (leadershipDecisions >= 3 ? 25 : 10) +
      (routingActions >= 4 ? 25 : 10) +
      (riskRounds >= 5 ? 25 : 10) +
      (crisisWords >= 40 ? 25 : 10),
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
  const overall = Math.round(
    PERFORMANCE_GAME_IDS.reduce((sum, gameId) => sum + toSafeNumber(scores[gameId], 0), 0) / PERFORMANCE_GAME_IDS.length
  );

  const roleMatchRate = Math.round(toSafeNumber(metrics.leadership.role_match_rate, 0) * 100);
  const technicalMismatch = toSafeNumber(metrics.leadership.technical_mismatch_count, 0);
  const overloads = toSafeNumber(metrics.leadership.overload_warnings, 0);
  const mismatchCount = toSafeNumber(metrics.leadership.mismatch_count, 0);
  const empathy = toSafeNumber(metrics.problemSolving.empathy, 0);
  const structure = toSafeNumber(metrics.problemSolving.structure, 0);
  const decisiveness = toSafeNumber(metrics.problemSolving.decisiveness, 0);
  const communicationScore = Math.round((empathy + structure + decisiveness) / 3);
  const riskControl = scores.risk;
  const multitask = scores.network;
  const explosions = toSafeNumber(metrics.risk.explosions, 0);
  const pressureScore = clamp(Math.round(riskControl * 0.58 + multitask * 0.42 - explosions * 4), 0, 100);
  const assignmentRiskLoad = clamp(Math.round(technicalMismatch * 14 + overloads * 16 + mismatchCount * 8), 0, 100);
  const readinessScore = clamp(
    Math.round(overall * 0.42 + roleMatchRate * 0.23 + communicationScore * 0.2 + pressureScore * 0.15 - assignmentRiskLoad * 0.12),
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
  if (personalityProfile) strengths.push(`Estilo de colaboración predominante: ${personalityProfile}.`);
  if (!strengths.length) strengths.push('Muestra disposición para adaptarse y sostener continuidad operativa.');

  const risks: string[] = [];
  if (technicalMismatch > 0) risks.push('Aparecen asignaciones con encaje bajo en tareas de alta exigencia.');
  if (overloads > 1) risks.push('Se concentra demasiada carga en parte del equipo.');
  if (communicationScore < 65) risks.push('En crisis, la comunicación pierde claridad y estructura.');
  if (pressureScore < 60 || explosions > 2) risks.push('El rendimiento cae cuando la presión sube rápidamente.');
  if (mismatchCount > 2) risks.push('El criterio de asignación se vuelve inestable al aumentar complejidad.');
  if (!risks.length) risks.push('No se detectan riesgos críticos en esta evaluación.');

  const interviewFocus: string[] = [];
  interviewFocus.push('Pedir un caso real de priorización con tiempo y recursos limitados.');
  if (technicalMismatch > 0 || mismatchCount > 2) {
    interviewFocus.push('Profundizar cómo decide quién toma cada tarea crítica y qué criterio utiliza.');
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
    interviewFocus: interviewFocus.slice(0, 3),
    interviewGuide: interviewGuide.slice(0, 3),
  };
};

const buildCandidateSummary = (
  scores: ScoresMap,
  _metrics: MetricsMap,
  strategyProfile: string,
  personalityProfile: string
) : CandidateSummaryPack => {
  const performanceRows = PERFORMANCE_GAME_IDS.map((gameId) => [gameId, toSafeNumber(scores[gameId], 0)] as const);
  const overall = Math.round(performanceRows.reduce((sum, [, score]) => sum + score, 0) / performanceRows.length);
  const highAreas = performanceRows.filter(([, score]) => score >= 75);
  const lowAreas = performanceRows.filter(([, score]) => score < 65);
  const topAreas = [...performanceRows].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const topAreaLabel = topAreas[0] ? gameLabelById[topAreas[0][0]] : 'perfil general';
  const focusAreaLabel = lowAreas[0] ? gameLabelById[lowAreas[0][0]] : 'ninguna crítica';

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
  const performanceRows = PERFORMANCE_GAME_IDS.map((gameId) => [gameId, toSafeNumber(scores[gameId], 0)] as const);
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

const getPersonalityDashboardData = (personalityMetrics: GameMetrics) => {
  const traitRows = [
    { key: 'disc_d_pct', label: 'Dominante', value: Math.round(toSafeNumber(personalityMetrics.disc_d_pct, 0)), color: 'bg-blue-500' },
    { key: 'disc_i_pct', label: 'Influyente', value: Math.round(toSafeNumber(personalityMetrics.disc_i_pct, 0)), color: 'bg-amber-500' },
    { key: 'disc_s_pct', label: 'Estable', value: Math.round(toSafeNumber(personalityMetrics.disc_s_pct, 0)), color: 'bg-emerald-500' },
    { key: 'disc_c_pct', label: 'Concienzudo', value: Math.round(toSafeNumber(personalityMetrics.disc_c_pct, 0)), color: 'bg-purple-500' },
  ];
  const questionRows = PERSONALITY_QUESTIONS.map((question, index) => {
    const key = index + 1;
    const rawChoice = String(personalityMetrics[`q${key}_choice`] || '');
    const selectedOption = question.options.find((opt) => opt.id === rawChoice);
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

const Dashboard = ({
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

  const radarData = [
    { subject: 'Memoria', score: scores.memory, fullMark: 100 },
    { subject: 'Gestión', score: scores.leadership, fullMark: 100 },
    { subject: 'Crisis', score: scores.problemSolving, fullMark: 100 },
    { subject: 'Riesgo', score: scores.risk, fullMark: 100 },
    { subject: 'Multitarea', score: scores.network, fullMark: 100 },
    { subject: 'Estrategia', score: scores.strategy, fullMark: 100 },
  ];

  const recruiterPack = useMemo(
    () => buildRecruiterInsights(scores, metrics, strategyProfile, personalityProfile),
    [scores, metrics, strategyProfile, personalityProfile]
  );

  const candidateSummary = useMemo(
    () => buildCandidateSummary(scores, metrics, strategyProfile, personalityProfile),
    [scores, metrics, strategyProfile, personalityProfile]
  );
  const profileNarrative = useMemo(
    () => buildProfileNarrative(scores, strategyProfile, personalityProfile),
    [scores, strategyProfile, personalityProfile]
  );
  const signalQuality = useMemo(() => buildSignalQuality(scores, metrics), [scores, metrics]);

  const overall = Math.round(
    PERFORMANCE_GAME_IDS.reduce((sum, gameId) => sum + toSafeNumber(scores[gameId], 0), 0) / PERFORMANCE_GAME_IDS.length
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
  }, [dashboardView, candidate.name, recruiterPack, overall, signalQuality.label, signalQuality.score, candidateSummary]);

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
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in pt-8 pb-20 px-4">
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-stone-200 pb-6 gap-4">
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
            <Clipboard className="w-4 h-4" /> {copyStatus === 'copied' ? 'Copiado' : copyStatus === 'error' ? 'Error al copiar' : 'Copiar resumen'}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Save className="w-4 h-4" /> Exportar informe
          </Button>
          <Button variant="secondary" onClick={onRestart}>
            <RotateCcw className="w-4 h-4" /> Nueva evaluación
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
              <div className="text-3xl font-bold text-stone-800">{overall}</div>
            </div>
          </div>
          <div className="w-full h-[260px] lg:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="score" stroke="#0891b2" strokeWidth={3} fill="#06b6d4" fillOpacity={0.3} />
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
          {personalityProfile ? (
            <div className="bg-gradient-to-r from-cyan-600 to-sky-600 rounded-xl p-4 text-white shadow-lg flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest font-bold text-white/80">Arquetipo detectado</div>
                <h3 className="text-xl font-bold mt-1">{personalityProfile}</h3>
              </div>
              <UserCircle className="w-9 h-9 text-white/80" />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            {radarData.map((item) => {
              const band = getScoreBand(item.score);
              return (
                <div key={item.subject} className="bg-white border border-stone-200 p-3 rounded-lg flex flex-col items-center shadow-sm">
                  <span className="text-xs text-stone-400 uppercase font-bold">{item.subject}</span>
                  <span className={`text-2xl font-bold ${band.color}`}>{item.score}%</span>
                  <span className="text-[10px] text-stone-400 uppercase tracking-wide">{band.label}</span>
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
            <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-2">Fortalezas clave</div>
            <ul className="space-y-2 text-sm text-stone-600">
              {profileNarrative.strengths.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-[11px] uppercase tracking-wide font-bold text-amber-700 mb-2">Debilidades observadas</div>
            <ul className="space-y-2 text-sm text-stone-600">
              {profileNarrative.weaknesses.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="text-[11px] uppercase tracking-wide font-bold text-stone-700 mb-2">Plan recomendado</div>
            <ul className="space-y-2 text-sm text-stone-600">
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
          className="w-full flex items-center justify-between text-left"
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
          <div className="mt-4">
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
              {personalityData.questionRows.map((row, index) => (
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
          <p className="mt-3 text-sm text-stone-500">Haz click en "Ver detalle" para abrir la lectura completa del test de arquetipo.</p>
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
              <ul className="mt-2 space-y-1 text-xs text-stone-600">
                {signalQuality.checks.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-cyan-600 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid="recruiter-executive-summary">
              <div className="text-[11px] uppercase tracking-wide font-bold text-stone-700 mb-2">Resumen ejecutivo (30 segundos)</div>
              <ul className="space-y-1.5 text-sm text-stone-700">
                {recruiterPack.executiveSummary.map((line) => (
                  <li key={line} className="flex items-start gap-2">
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
                <ul className="space-y-1.5 text-sm text-stone-600">
                  {recruiterPack.strengths.map((item) => (
                    <li key={item} className="flex items-start gap-2">
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
                <ul className="space-y-1.5 text-sm text-stone-600">
                  {recruiterPack.risks.map((item) => (
                    <li key={item} className="flex items-start gap-2">
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
                <ul className="space-y-1.5 text-sm text-stone-600">
                  {recruiterPack.interviewFocus.map((item) => (
                    <li key={item} className="flex items-start gap-2">
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
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
              <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-1">Lectura rápida</div>
              <h4 className="text-lg font-bold text-stone-800">{candidateSummary.title}</h4>
              <p className="text-sm text-stone-700 mt-1">{candidateSummary.snapshot}</p>
            </div>

            <ScoreLegend mode="candidate" />

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
                <div className="text-[11px] uppercase tracking-wide font-bold text-stone-600">Qué tan estable fue tu evaluación</div>
                <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border ${toneToBadge(signalQuality.tone).style}`}>
                  {signalQuality.label} ({signalQuality.score}/100)
                </span>
              </div>
              <p className="text-sm text-stone-700 mt-1">{signalQuality.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="candidate-fast-read">
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-1">Tu mejor eje</div>
                <div className="text-sm font-semibold text-stone-800">{candidateSummary.topArea}</div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-amber-700 mb-1">Eje a reforzar</div>
                <div className="text-sm font-semibold text-stone-800">{candidateSummary.focusArea}</div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-stone-700 mb-1">Meta inmediata</div>
                <div className="text-sm font-semibold text-stone-800">Consistencia semanal</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-2">Lo que hiciste bien</div>
                <ul className="space-y-1.5 text-sm text-stone-600">
                  {candidateSummary.strengths.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-amber-700 mb-2">Para mejorar</div>
                <ul className="space-y-1.5 text-sm text-stone-600">
                  {candidateSummary.developmentAreas.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide font-bold text-stone-700 mb-2">Próximos pasos</div>
                <ul className="space-y-1.5 text-sm text-stone-600">
                  {candidateSummary.nextSteps.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid="candidate-weekly-plan">
              <div className="text-[11px] uppercase tracking-wide font-bold text-cyan-700 mb-2">Plan de 3 semanas</div>
              <ul className="space-y-1.5 text-sm text-stone-600">
                {candidateSummary.weeklyPlan.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default function Page() {
  const router = useRouter();
  const sessionId = useStableSessionId();
  const [stage, transitionStage] = useStateMachine<Stage>('login', STAGE_TRANSITIONS, 'pageStage');
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [scores, setScores] = useState<ScoresMap>(EMPTY_SCORES);
  const [metrics, setMetrics] = useState<MetricsMap>(EMPTY_METRICS);
  const [strategyProfile, setStrategyProfile] = useState('');
  const [personalityProfile, setPersonalityProfile] = useState('');
  const [, setSeenTutorials] = useState<SeenTutorialMap>({});
  const [completedGameDurationsSec, setCompletedGameDurationsSec] = useState<Partial<Record<GameId, number>>>({});
  const [playingClockTick, setPlayingClockTick] = useState(0);

  const resumeRef = useRef<ResumeSnapshot | null>(null);
  const activeGameStartedAtRef = useRef<number | null>(null);
  const [canResume, setCanResume] = useState(false);

  const telemetry = useTelemetry(sessionId, candidate);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ResumeSnapshot;
      if (parsed?.candidate && typeof parsed?.currentGameIndex === 'number') {
        resumeRef.current = parsed;
        setCanResume(true);
      }
    } catch {
      resumeRef.current = null;
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TUTORIALS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SeenTutorialMap;
      setSeenTutorials(parsed || {});
    } catch {
      setSeenTutorials({});
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debugStage = params.get('debug_stage');
    if (debugStage !== 'results') return;

    const debugAccess: AccessType = params.get('debug_access') === 'recruiter' ? 'recruiter' : 'candidate';
    const fixture = DEBUG_RESULTS_FIXTURE;

    setCandidate(buildDebugCandidate(debugAccess));
    setCurrentGameIndex(GAME_DEFS.length - 1);
    setScores({ ...fixture.scores });
    setMetrics({ ...fixture.metrics });
    setStrategyProfile(fixture.strategyProfile);
    setPersonalityProfile(fixture.personalityProfile);
    setCompletedGameDurationsSec({ ...fixture.completedGameDurationsSec });
    transitionStage('results', { force: true });
    setCanResume(false);

    telemetry.track('debug_stage_boot', { stage: 'results', accessType: debugAccess });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug_stage')) return;
    const debugGame = params.get('debug_game');
    if (!debugGame) return;
    const gameIndex = GAME_DEFS.findIndex((game) => game.id === debugGame);
    if (gameIndex < 0) return;

    setCandidate({
      name: 'Debug Candidate',
      email: 'debug@initium.local',
      role: 'QA',
      accessType: 'candidate',
      acceptedTerms: true,
      acceptedDataPolicy: true,
    });
    setCurrentGameIndex(gameIndex);
    transitionStage('playing', { force: true });
    setCanResume(false);
    telemetry.track('debug_game_boot', { gameId: debugGame });
  }, []);

  useEffect(() => {
    if (stage !== 'playing') return;
    if (!activeGameStartedAtRef.current) {
      activeGameStartedAtRef.current = Date.now();
    }
    const timer = window.setInterval(() => {
      setPlayingClockTick((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  const saveProgress = useCallback(
    (source: 'manual' | 'auto') => {
      if (!candidate) return;
      if (!['consent', 'welcome', 'contextIntro', 'instructions', 'betweenGames', 'playing'].includes(stage)) return;

      const snapshot: ResumeSnapshot = {
        stage,
        currentGameIndex,
        candidate,
        scores,
        metrics,
        strategyProfile,
        personalityProfile,
        completedGameDurationsSec,
        createdAt: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      if (source === 'manual') {
        telemetry.track('progress_saved', { stage, currentGameIndex });
      }
    },
    [candidate, stage, currentGameIndex, scores, metrics, strategyProfile, personalityProfile, completedGameDurationsSec, telemetry]
  );

  useEffect(() => {
    saveProgress('auto');
  }, [saveProgress]);

  const markTutorialSeen = useCallback((gameId: GameId) => {
    setSeenTutorials((prev) => {
      if (prev[gameId]) return prev;
      const next = { ...prev, [gameId]: true };
      try {
        localStorage.setItem(TUTORIALS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const resumeSession = () => {
    const snapshot = resumeRef.current;
    if (!snapshot) return;
    const safeGameIndex = clamp(snapshot.currentGameIndex, 0, GAME_DEFS.length - 1);
    const restoredGameId = GAME_DEFS[safeGameIndex]?.id;
    const restoredStage =
      snapshot.stage === 'instructions' && restoredGameId === 'personality' ? 'playing' : snapshot.stage;

    const restoredCandidate = snapshot.candidate as Partial<CandidateProfile>;
    setCandidate({
      name: restoredCandidate.name || 'Candidato',
      email: restoredCandidate.email || '',
      role: restoredCandidate.role || '',
      accessType: restoredCandidate.accessType === 'recruiter' ? 'recruiter' : 'candidate',
      acceptedTerms: Boolean(restoredCandidate.acceptedTerms),
      acceptedDataPolicy: Boolean(restoredCandidate.acceptedDataPolicy),
    });
    transitionStage(restoredStage, { force: true });
    setCurrentGameIndex(safeGameIndex);
    setScores({ ...EMPTY_SCORES, ...snapshot.scores });
    setMetrics({ ...EMPTY_METRICS, ...snapshot.metrics });
    setStrategyProfile(snapshot.strategyProfile);
    setPersonalityProfile(snapshot.personalityProfile || '');
    setCompletedGameDurationsSec(snapshot.completedGameDurationsSec || {});
    activeGameStartedAtRef.current = null;
    telemetry.track('session_resumed', { stage: restoredStage, currentGameIndex: safeGameIndex });
    setCanResume(false);
  };

  const resetAll = () => {
    transitionStage('login', { force: true });
    setCandidate(null);
    setCurrentGameIndex(0);
    setScores(EMPTY_SCORES);
    setMetrics(EMPTY_METRICS);
    setStrategyProfile('');
    setPersonalityProfile('');
    setCompletedGameDurationsSec({});
    activeGameStartedAtRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    telemetry.track('session_reset');
  };

  const handleGameComplete = useCallback(
    (result: GameResult) => {
      const gameId = GAME_DEFS[currentGameIndex].id;
      const nextScores = { ...scores, [gameId]: result.score };
      const nextMetrics = { ...metrics, [gameId]: result.metrics };

      markTutorialSeen(gameId);
      setScores(nextScores);
      setMetrics(nextMetrics);

      const startedAt = activeGameStartedAtRef.current;
      if (startedAt) {
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        setCompletedGameDurationsSec((prev) => ({ ...prev, [gameId]: durationSec }));
      }
      activeGameStartedAtRef.current = null;

      telemetry.track(
        'game_completed',
        {
          score: result.score,
          metrics: result.metrics,
        },
        gameId
      );

      if (currentGameIndex < GAME_DEFS.length - 1) {
        const nextIndex = currentGameIndex + 1;
        const fromGame = GAME_DEFS[currentGameIndex];
        const toGame = GAME_DEFS[nextIndex];
        setCurrentGameIndex(nextIndex);
        transitionStage('betweenGames');
        telemetry.track('transition_started', {
          from: fromGame.id,
          to: toGame.id,
        });
        return;
      }

      transitionStage('results');
      telemetry.track('session_completed', {
        overall: Math.round(
          PERFORMANCE_GAME_IDS.reduce((sum, gameId) => sum + toSafeNumber(nextScores[gameId], 0), 0) /
            PERFORMANCE_GAME_IDS.length
        ),
      });
      if (candidate && candidate.accessType === 'candidate' && !candidate.email.endsWith('@initium.local')) {
        const summary = buildAssessmentSummary(nextScores as Record<string, number>);
        void persistAssessmentResult({
          id: sessionId,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          role: candidate.role,
          completedAt: new Date().toISOString(),
          strategyProfile,
          personalityProfile,
          scores: nextScores as Record<string, number>,
          metrics: nextMetrics as Record<string, Record<string, number | string | boolean>>,
          totalScore: summary.totalScore,
          technicalScore: summary.technicalScore,
          cognitiveScore: summary.cognitiveScore,
          softSkillsScore: summary.softSkillsScore,
          fitScores: summary.fitScores,
        }).catch((error) => {
          console.error('Failed to persist assessment result', error);
        });
      }
      localStorage.removeItem(STORAGE_KEY);
    },
    [candidate, currentGameIndex, markTutorialSeen, metrics, personalityProfile, scores, sessionId, strategyProfile, telemetry]
  );

  const gameTrack = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      const gameId = GAME_DEFS[currentGameIndex].id;
      telemetry.track(event, payload, gameId);
    },
    [currentGameIndex, telemetry.track]
  );

  const renderGame = () => {
    const gameId = GAME_DEFS[currentGameIndex].id;

    if (gameId === 'personality') {
      return (
        <GamePersonality
          onComplete={handleGameComplete}
          track={gameTrack}
          setPersonalityProfile={setPersonalityProfile}
        />
      );
    }
    if (gameId === 'memory') return <GameMemory onComplete={handleGameComplete} track={gameTrack} />;
    if (gameId === 'leadership') return <GameLeadershipV2 onComplete={handleGameComplete} track={gameTrack} />;
    if (gameId === 'problemSolving') {
      return (
        <GameProblemSolving
          onComplete={handleGameComplete}
          track={gameTrack}
          candidateRole={candidate?.role || ''}
        />
      );
    }
    if (gameId === 'risk') return <GameRisk onComplete={handleGameComplete} track={gameTrack} />;
    if (gameId === 'network') return <GameNetwork onComplete={handleGameComplete} track={gameTrack} />;
    if (gameId === 'strategy') {
      return (
        <GameStrategy
          onComplete={handleGameComplete}
          track={gameTrack}
          setStrategyProfile={setStrategyProfile}
        />
      );
    }
    return null;
  };

  const renderContent = () => {
    if (stage === 'login') {
      return (
        <LoginScreen
          canResume={canResume}
          onResume={resumeSession}
          onSubmit={async (data) => {
            telemetry.track('session_started', {
              role: data.role,
              accessType: data.accessType,
              emailMasked: maskEmail(data.email),
            });

            if (data.accessType === 'recruiter') {
              try {
                const response = await startRecruiterAccess({
                  name: data.name,
                  email: data.email,
                });
                writeRecruiterAccessSession(response.session);
              } catch (error) {
                console.error('Failed to persist recruiter login', error);
                writeRecruiterAccessSession({
                  name: data.name,
                  email: data.email,
                });
              }
              router.push('/admin');
              return;
            }

            clearRecruiterAccessSession();
            const nextCandidate: CandidateProfile = {
              ...data,
              acceptedTerms: false,
              acceptedDataPolicy: false,
            };
            setCandidate(nextCandidate);
            transitionStage('consent');
          }}
        />
      );
    }

    if (!candidate) return null;

    if (stage === 'consent') {
      return (
        <ConsentScreen
          candidate={candidate}
          onBack={() => transitionStage('login')}
          onConfirm={(nextCandidate) => {
            setCandidate(nextCandidate);
            transitionStage('welcome');
            telemetry.track('consent_confirmed', {
              acceptedTerms: nextCandidate.acceptedTerms,
              acceptedDataPolicy: nextCandidate.acceptedDataPolicy,
            });
          }}
        />
      );
    }

    if (stage === 'welcome') {
      return (
        <WelcomeScreen
          candidate={candidate}
          onStart={() => {
            if (currentGameIndex === 0) {
              transitionStage('contextIntro');
              telemetry.track('context_intro_started');
              return;
            }
            transitionStage('instructions');
            telemetry.track('assessment_started');
          }}
        />
      );
    }

    if (stage === 'contextIntro') {
      return (
        <ContextIntroScreen
          onComplete={() => {
            transitionStage('playing');
            markTutorialSeen('personality');
            telemetry.track('context_intro_completed');
            telemetry.track('assessment_started');
            telemetry.track('game_started', { gameIndex: 0 }, 'personality');
          }}
        />
      );
    }

    if (stage === 'instructions') {
      return (
        <InstructionsScreen
          gameIndex={currentGameIndex}
          onStart={() => {
            markTutorialSeen(GAME_DEFS[currentGameIndex].id);
            transitionStage('playing');
            telemetry.track('game_started', { gameIndex: currentGameIndex }, GAME_DEFS[currentGameIndex].id);
          }}
        />
      );
    }

    if (stage === 'betweenGames') {
      const nextGame = GAME_DEFS[currentGameIndex];
      const previousGame = GAME_DEFS[Math.max(0, currentGameIndex - 1)];
      const transitionLine =
        BETWEEN_GAME_LINES[(currentGameIndex - 1 + BETWEEN_GAME_LINES.length) % BETWEEN_GAME_LINES.length];

      return (
        <BetweenGamesTransitionScreen
          fromTitle={previousGame.title}
          toTitle={nextGame.title}
          line={transitionLine}
          onComplete={() => {
            transitionStage('instructions');
            telemetry.track('transition_completed', { from: previousGame.id, to: nextGame.id });
          }}
        />
      );
    }

    if (stage === 'playing') {
      return renderGame();
    }

    if (stage === 'results') {
      return (
        <Dashboard
          candidate={candidate}
          scores={scores}
          metrics={metrics}
          strategyProfile={strategyProfile}
          personalityProfile={personalityProfile}
          onRestart={resetAll}
        />
      );
    }

    return null;
  };

  const showProgress =
    stage === 'contextIntro' || stage === 'instructions' || stage === 'betweenGames' || stage === 'playing';

  const estimatedRemainingSec = useMemo(() => {
    const futureSec = GAME_DEFS.slice(currentGameIndex + 1).reduce((sum, game) => sum + game.estSec, 0);
    const currentGameEstSec = GAME_DEFS[currentGameIndex]?.estSec || 0;
    const currentElapsedSec =
      stage === 'playing' && activeGameStartedAtRef.current
        ? Math.floor((Date.now() - activeGameStartedAtRef.current) / 1000)
        : 0;
    const currentSec = stage === 'playing' ? Math.max(0, currentGameEstSec - currentElapsedSec) : currentGameEstSec;
    const baseRemainingSec = currentSec + futureSec;

    const entries = Object.entries(completedGameDurationsSec) as Array<[GameId, number]>;
    if (!entries.length) return baseRemainingSec;

    const estimatedCompletedSec = entries.reduce((sum, [gameId]) => {
      const def = GAME_DEFS.find((game) => game.id === gameId);
      return sum + (def?.estSec || 0);
    }, 0);
    if (!estimatedCompletedSec) return baseRemainingSec;

    const actualCompletedSec = entries.reduce((sum, [, sec]) => sum + sec, 0);
    const paceRatio = clamp(actualCompletedSec / estimatedCompletedSec, 0.7, 1.65);
    return Math.max(0, Math.round(baseRemainingSec * paceRatio));
  }, [completedGameDurationsSec, currentGameIndex, playingClockTick, stage]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 selection:bg-cyan-100">
      {showProgress ? (
        <ProgressBar
          currentStep={currentGameIndex}
          remainingSecOverride={estimatedRemainingSec}
          onSave={() => saveProgress('manual')}
        />
      ) : null}
      <div className="pb-12">{renderContent()}</div>

      <style jsx global>{`
        @keyframes fillBar {
          0% {
            width: 0%;
            opacity: 0.5;
          }
          70% {
            width: 85%;
            opacity: 1;
            background-color: #06b6d4;
          }
          75% {
            width: 90%;
            background-color: #ef4444;
          }
          100% {
            width: 90%;
            opacity: 0;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
