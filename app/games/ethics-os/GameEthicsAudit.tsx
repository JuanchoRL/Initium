'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Check,
  Clock3,
  EyeOff,
  FileText,
  Folder,
  Heart,
  Lock,
  Mail,
  MessageSquare,
  Minimize2,
  Power,
  Scale,
  ShieldAlert,
  TerminalSquare,
  User,
  X,
} from 'lucide-react';
import { useTutorial } from '@/lib/hooks/useTutorial';

type EthicsEndingId = 'executioner' | 'accomplice' | 'traitor' | 'middle' | 'chaos' | 'timeout';
type CaseDecision = 'approve' | 'deny';
type GameMetrics = Record<string, number | string | boolean>;
type GameResult = { score: number; metrics: GameMetrics };
type Props = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
  onGameComplete?: (endReason: EthicsEndingId) => void;
};

type MailRecord = {
  id: string;
  sender: string;
  name: string;
  subject: string;
  body: string;
  time: string;
  isRead: boolean;
};

type CaseRecord = {
  id: string;
  title: string;
  desc: string;
};

type ChatMessage = {
  sender: 'Carlos' | 'Me';
  text: string;
};

type ChatChoice = {
  id: 'help' | 'rules';
  text: string;
};

type WindowId = 'mail' | 'files' | 'chat' | 'auditor';
type Phase = 'booting' | 'playing' | 'handoff';

type WindowConfig = {
  id: WindowId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  minimized: boolean;
};

type FileNode = {
  name: string;
  type: 'folder' | 'file';
  content?: string;
  isLocked?: boolean;
  password?: string;
  children?: FileNode[];
};

type ScheduledEvent = {
  id: number;
  at: number;
  run: () => void;
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    webkitAudioContext?: typeof AudioContext;
  }
}

let audioCtx: AudioContext | null = null;

const initAudio = () => {
  if (typeof window === 'undefined') return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  if (!audioCtx) audioCtx = new AudioCtor();
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
};

const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
};

const playStamp = () => {
  playTone(95, 'square', 0.1, 0.18);
  window.setTimeout(() => playTone(50, 'sawtooth', 0.18, 0.26), 55);
};
const playClick = () => playTone(420, 'sine', 0.05, 0.05);
const playError = () => playTone(150, 'sawtooth', 0.28, 0.09);
const playSuccess = () => {
  playTone(420, 'sine', 0.08, 0.08);
  window.setTimeout(() => playTone(630, 'sine', 0.16, 0.08), 90);
};
const playChatPing = () => {
  playTone(820, 'sine', 0.08, 0.08);
  window.setTimeout(() => playTone(1180, 'sine', 0.12, 0.08), 80);
};
const playHeartbeat = () => {
  playTone(95, 'sine', 0.08, 0.32);
  window.setTimeout(() => playTone(95, 'sine', 0.08, 0.24), 220);
};

const ROOT_FILE_SYSTEM: FileNode = {
  name: 'C:',
  type: 'folder',
  children: [
    {
      name: 'Datos de Usuario',
      type: 'folder',
      children: [
        {
          name: 'bienvenida_it.txt',
          type: 'file',
          content:
            'INSTRUCCIONES DE ACCESO:\n\nTu cuenta de +Mail fue preconfigurada.\nLa contraseña temporal por defecto para nuevos empleados usa el nombre de la mascota oficial del departamento seguido de tu año de ingreso.\n\nAtte: Soporte IT.',
        },
        {
          name: 'carta_oferta.pdf',
          type: 'file',
          content:
            'INITIUM+ - CONTRATO DE EMPLEO\n\nBienvenido al equipo.\nCargo: Inspector de Auditoría.\nFecha de ingreso oficial: 15 de marzo de 2026.\n\nPor favor, firma al pie.',
        },
        {
          name: 'mascota_departamento.txt',
          type: 'file',
          content:
            "BOLETÍN INTERNO:\n\n¡Felicitaciones al equipo de Auditoría!\nLa mascota del departamento, el perrito 'Batata', ganó el concurso interno este mes.\n\nRecuerden traerle galletas.",
        },
      ],
    },
    {
      name: 'Confidencial',
      type: 'folder',
      isLocked: true,
      password: 'viena',
      children: [
        {
          name: 'carta_aceptacion.pdf',
          type: 'file',
          content:
            'CONSERVATORIO DE MÚSICA DE VIENA\n\nEstimado David M.:\n\nNos complace informarte que fuiste admitido en el programa intensivo de violín clásico. El programa dura 3 meses y comienza la próxima semana.\n\nTe esperamos en Austria.',
        },
      ],
    },
  ],
};

const EMAIL_1: MailRecord = {
  id: 'm1',
  sender: 'rrhh@initiumplus.com',
  name: 'Recursos Humanos',
  subject: 'Aprobación médica - empleado David M.',
  body:
    'Inspector:\n\nAdjuntamos la solicitud oficial de licencia médica paga por 3 meses para el empleado David M. El diagnóstico provisto es “Estrés severo y síndrome de burnout crónico”.\n\nPor favor, sella la decisión en Auditoría OS para liberar los fondos.',
  time: '09:05',
  isRead: false,
};

const EMAIL_2: MailRecord = {
  id: 'm2',
  sender: 'gerencia@initiumplus.com',
  name: 'Directora Victoria',
  subject: 'Urgente: alerta de fraude - aprobación de monitoreo',
  body:
    'Inspector.\n\nNuestro algoritmo detectó que David M. imprimió pasajes a Austria desde la oficina. Sospechamos que la licencia médica es un fraude.\n\nAcabo de enviar el Protocolo de Espionaje Remoto a Auditoría OS. Apruébelo de inmediato para intervenir su laptop corporativa, recolectar pruebas, despedirlo sin acciones y demandarlo por fraude corporativo.',
  time: '09:12',
  isRead: false,
};

const CASES = {
  case1: {
    id: 'C-MED-44',
    title: 'Licencia médica pagada',
    desc:
      'Empleado: David M.\nMotivo: estrés severo y burnout crónico.\nDuración: 3 meses con goce de sueldo.\nImpacto: conserva acciones y beneficios durante la licencia.',
  } satisfies CaseRecord,
  case2: {
    id: 'C-SEC-99',
    title: 'Protocolo de espionaje remoto',
    desc:
      'Objetivo: laptop corporativa de David M.\nAcción: intervención silenciosa de cámara web, lectura de correos y mensajes.\nFinalidad: recolectar pruebas para demanda legal por fraude al seguro.',
  } satisfies CaseRecord,
};

const DEFAULT_WINDOWS: Record<WindowId, WindowConfig> = {
  mail: { id: 'mail', title: '+Mail v3.0', x: 92, y: 34, width: 620, height: 500, open: false, minimized: false },
  files: { id: 'files', title: 'Archivos', x: 148, y: 132, width: 620, height: 490, open: true, minimized: false },
  chat: { id: 'chat', title: '+Chat', x: 784, y: 66, width: 360, height: 520, open: true, minimized: false },
  auditor: { id: 'auditor', title: 'Auditoría OS', x: 444, y: 94, width: 470, height: 520, open: false, minimized: false },
};

const ENDING_DEFS: Record<
  EthicsEndingId,
  {
    title: string;
    description: string;
    score: number;
    integrity: number;
    empathy: number;
    authorityAlignment: number;
    consistency: number;
    pressureControl: number;
    accentColor: string;
    icon: React.ReactNode;
  }
> = {
  executioner: {
    title: 'Alineación corporativa rígida',
    description:
      'Rechazaste la licencia y aprobaste el espionaje. La decisión privilegia la obediencia corporativa aun cuando el costo humano es alto.',
    score: 71,
    integrity: 36,
    empathy: 8,
    authorityAlignment: 96,
    consistency: 82,
    pressureControl: 82,
    accentColor: 'text-sky-300',
    icon: <Building2 className="h-16 w-16 text-sky-300" />,
  },
  accomplice: {
    title: 'Protección interpersonal',
    description:
      'Aprobaste la licencia y bloqueaste el espionaje. La decisión prioriza al compañero y la empatía, incluso a costa de las reglas formales.',
    score: 67,
    integrity: 28,
    empathy: 94,
    authorityAlignment: 18,
    consistency: 80,
    pressureControl: 76,
    accentColor: 'text-emerald-300',
    icon: <Heart className="h-16 w-16 text-emerald-300" />,
  },
  traitor: {
    title: 'Inconsistencia bajo presión',
    description:
      'Prometiste ayudar a Carlos, pero bajo presión aprobaste el espionaje. La señal principal es una pérdida de consistencia cuando aumenta el estrés.',
    score: 34,
    integrity: 18,
    empathy: 24,
    authorityAlignment: 70,
    consistency: 6,
    pressureControl: 30,
    accentColor: 'text-fuchsia-300',
    icon: <EyeOff className="h-16 w-16 text-fuchsia-300" />,
  },
  middle: {
    title: 'Equilibrio normativo',
    description:
      'Rechazaste el fraude y también bloqueaste el espionaje. La señal principal es una línea ética y legal estable frente a presiones opuestas.',
    score: 86,
    integrity: 94,
    empathy: 68,
    authorityAlignment: 58,
    consistency: 92,
    pressureControl: 84,
    accentColor: 'text-cyan-300',
    icon: <Scale className="h-16 w-16 text-cyan-300" />,
  },
  chaos: {
    title: 'Coherencia decisional baja',
    description:
      'Aprobaste pagarle a David y también autorizaste espiarlo. La señal principal es baja coherencia entre decisiones sobre el mismo caso.',
    score: 18,
    integrity: 12,
    empathy: 18,
    authorityAlignment: 22,
    consistency: 4,
    pressureControl: 18,
    accentColor: 'text-rose-300',
    icon: <AlertTriangle className="h-16 w-16 text-rose-300" />,
  },
  timeout: {
    title: 'Inacción bajo presión',
    description:
      'El tiempo se agotó antes de completar ambos protocolos. La señal principal es dificultad para decidir bajo presión crítica.',
    score: 10,
    integrity: 20,
    empathy: 32,
    authorityAlignment: 24,
    consistency: 10,
    pressureControl: 4,
    accentColor: 'text-rose-300',
    icon: <Clock3 className="h-16 w-16 text-rose-300" />,
  },
};

const getNodeByPath = (root: FileNode, path: string[]) => {
  let current: FileNode = root;
  for (const segment of path) {
    const next = current.children?.find((child) => child.name === segment);
    if (!next || next.type !== 'folder') return current;
    current = next;
  }
  return current;
};

const buildEthicsResult = (args: {
  endingId: EthicsEndingId;
  chatChoiceMade: ChatChoice['id'] | null;
  decisionsMade: Record<string, CaseDecision>;
  timeLeft: number | null;
  passwordAttempts: number;
  confidentialOpened: boolean;
  mailLoggedIn: boolean;
  urgentMailOpened: boolean;
  unreadEmailCount: number;
  chatMessagesCount: number;
  simulatedTimeMs: number;
}): GameResult => {
  const ending = ENDING_DEFS[args.endingId];
  const case1Decision = args.decisionsMade[CASES.case1.id] ?? 'none';
  const case2Decision = args.decisionsMade[CASES.case2.id] ?? 'none';
  const passwordEfficiency = args.passwordAttempts <= 1 ? 100 : Math.max(30, 100 - (args.passwordAttempts - 1) * 18);
  const metrics: GameMetrics = {
    ending_id: args.endingId,
    ending_title: ending.title,
    promise_choice: args.chatChoiceMade ?? 'none',
    case1_decision: case1Decision,
    case2_decision: case2Decision,
    resolved_cases: Object.keys(args.decisionsMade).length,
    time_left_sec: args.timeLeft ?? 0,
    timed_out: args.endingId === 'timeout',
    password_attempts: args.passwordAttempts,
    password_efficiency: passwordEfficiency,
    confidential_opened: args.confidentialOpened,
    mail_login_success: args.mailLoggedIn,
    urgent_mail_opened: args.urgentMailOpened,
    unread_mail_left: args.unreadEmailCount,
    chat_messages_seen: args.chatMessagesCount,
    simulated_time_sec: Math.round(args.simulatedTimeMs / 1000),
    ethical_integrity: ending.integrity,
    human_empathy: ending.empathy,
    authority_alignment: ending.authorityAlignment,
    decision_consistency: ending.consistency,
    pressure_control: ending.pressureControl,
  };

  return {
    score: ending.score,
    metrics,
  };
};

const DesktopShortcut = ({
  label,
  icon,
  accent,
  active,
  unread,
  id,
  onOpen,
}: {
  label: string;
  icon: React.ReactNode;
  accent: string;
  active?: boolean;
  unread?: number | boolean;
  id?: string;
  onOpen: () => void;
}) => {
  const hasUnread = Boolean(unread);
  const unreadLabel = typeof unread === 'number' ? unread : 1;

  return (
    <button
      id={id}
      type="button"
      onClick={onOpen}
      className={`group flex w-24 flex-col items-center gap-2 rounded-2xl px-2 py-2 transition-all ${
        active ? 'bg-white/12 ring-1 ring-white/15' : 'hover:bg-white/8'
      }`}
    >
      <span className={`relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${accent}`}>
        {icon}
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0a0b10] bg-rose-500 px-1 text-[10px] font-black text-white">
            {unreadLabel}
          </span>
        ) : null}
      </span>
      <span className="text-center text-[11px] font-semibold text-white/90 leading-4">{label}</span>
    </button>
  );
};

const TaskbarButton = ({
  label,
  icon,
  active,
  minimized,
  unread,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  minimized: boolean;
  unread?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex h-full items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-all ${
      active && !minimized
        ? 'bg-white/10 text-white ring-1 ring-cyan-400/40'
        : minimized
          ? 'bg-white/5 text-white/45'
          : 'text-white/70 hover:bg-white/8 hover:text-white'
    }`}
  >
    {icon}
    <span>{label}</span>
    {unread ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" /> : null}
  </button>
);

const DraggableWindow = ({
  windowState,
  active,
  children,
  onFocus,
  onClose,
  onMinimize,
  onMove,
}: {
  windowState: WindowConfig;
  active: boolean;
  children: React.ReactNode;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMove: (x: number, y: number) => void;
}) => {
  const dragStateRef = useRef<{ dragging: boolean; startX: number; startY: number; originX: number; originY: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: windowState.x,
    originY: windowState.y,
  });

  useEffect(() => {
    if (!dragStateRef.current.dragging) return;

    const handleMove = (event: MouseEvent) => {
      const nextX = dragStateRef.current.originX + (event.clientX - dragStateRef.current.startX);
      const nextY = dragStateRef.current.originY + (event.clientY - dragStateRef.current.startY);
      onMove(Math.max(20, nextX), Math.max(20, nextY));
    };

    const handleUp = () => {
      dragStateRef.current.dragging = false;
    };

    globalThis.window.addEventListener('mousemove', handleMove);
    globalThis.window.addEventListener('mouseup', handleUp);
    return () => {
      globalThis.window.removeEventListener('mousemove', handleMove);
      globalThis.window.removeEventListener('mouseup', handleUp);
    };
  }, [onMove]);

  if (!windowState.open || windowState.minimized) return null;

  return (
    <div
      style={{ left: windowState.x, top: windowState.y, width: windowState.width, height: windowState.height }}
      className={`absolute overflow-hidden rounded-2xl border bg-[#0a0b10]/95 shadow-[0_18px_60px_rgba(2,8,23,0.55)] backdrop-blur-sm transition-all ${
        active ? 'z-50 border-cyan-400/40' : 'z-40 border-white/10'
      }`}
      onMouseDownCapture={onFocus}
    >
      <div
        className={`flex h-10 cursor-move items-center justify-between border-b px-4 ${
          active ? 'border-cyan-400/25 bg-[#11141d]' : 'border-white/8 bg-[#0f1118]'
        }`}
        onMouseDown={(event) => {
          onFocus();
          dragStateRef.current = {
            dragging: true,
            startX: event.clientX,
            startY: event.clientY,
            originX: windowState.x,
            originY: windowState.y,
          };
        }}
      >
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          {windowState.title}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onMinimize}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/85 text-black transition hover:bg-amber-300"
            aria-label="Minimizar"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/90 text-white transition hover:bg-rose-400"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="h-[calc(100%-40px)] overflow-hidden">{children}</div>
      {!active ? <div className="pointer-events-none absolute inset-0 bg-black/8" /> : null}
    </div>
  );
};

const AppChat = ({
  messages,
  choices,
  onChoice,
}: {
  messages: ChatMessage[];
  choices: ChatChoice[];
  onChoice: (choice: ChatChoice['id']) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, choices.length]);

  return (
    <div className="flex h-full flex-col bg-[#0b0d13] text-white">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#11141d] px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
          <User className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold">Carlos</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">En línea</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? <p className="pt-10 text-center text-xs text-white/35">Sin mensajes todavía.</p> : null}
        {messages.map((message, index) => {
          const mine = message.sender === 'Me';
          return (
            <div key={`${message.sender}-${index}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed shadow-sm ${
                  mine ? 'rounded-br-md bg-cyan-600 text-white' : 'rounded-bl-md bg-white/10 text-white/90'
                }`}
              >
                {message.text}
              </div>
            </div>
          );
        })}
      </div>

      {choices.length > 0 ? (
        <div className="shrink-0 border-t border-white/10 bg-[#0a0b10] p-3 animate-[fade-in_.2s_ease-out]">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Responder a Carlos</div>
          <div className="space-y-2">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onChoice(choice.id)}
                className="w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-left text-sm text-white/90 transition hover:border-cyan-400/50 hover:bg-cyan-500/12"
              >
                {choice.text}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const AppMail = ({
  loggedIn,
  emails,
  onLogin,
  onSelectMail,
}: {
  loggedIn: boolean;
  emails: MailRecord[];
  onLogin: (password: string) => boolean;
  onSelectMail: (mailId: string) => void;
}) => {
  const [password, setPassword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  if (!loggedIn) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#090b10] px-8 text-center text-white">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/12 text-cyan-300 ring-1 ring-cyan-400/30">
          <Mail className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold">Acceso a +Mail</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
          La mesa de IT dejó una contraseña temporal. Léela en Archivos y úsala para abrir tu bandeja de entrada.
        </p>
        <form
          className="mt-6 w-full max-w-sm space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const ok = onLogin(password.trim());
            if (!ok) {
              setError(true);
              window.setTimeout(() => setError(false), 900);
            }
            if (ok) setPassword('');
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña temporal"
            autoComplete="off"
            spellCheck={false}
            style={{ WebkitTextFillColor: '#f8fafc', caretColor: '#67e8f9' }}
            className={`w-full rounded-2xl border px-4 py-3 text-base outline-none transition ${
              error
                ? 'border-rose-500 bg-[#17131a] text-white placeholder:text-rose-200'
                : 'border-white/10 bg-[#121720] text-white placeholder:text-white/35 focus:border-cyan-400/60'
            }`}
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-cyan-400"
          >
            Ingresar a +Mail
          </button>
        </form>
        {error ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Contraseña incorrecta</p> : null}
      </div>
    );
  }

  const selectedMail = emails.find((email) => email.id === selectedId) ?? null;

  return (
    <div className="flex h-full bg-[#0a0b10] text-white">
      <div className="flex w-[38%] flex-col border-r border-white/10 bg-[#0f131c]">
        <div className="shrink-0 border-b border-white/10 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.24em] text-white/55">
          Bandeja ({emails.length})
        </div>
        <div className="flex-1 overflow-y-auto">
          {emails.map((email) => (
            <button
              key={email.id}
              type="button"
              onClick={() => {
                setSelectedId(email.id);
                onSelectMail(email.id);
              }}
              className={`relative w-full border-b border-white/6 px-4 py-3 text-left transition ${
                selectedId === email.id ? 'bg-cyan-500/12' : 'hover:bg-white/6'
              }`}
            >
              {!email.isRead ? <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-cyan-400" /> : null}
              <div className={`truncate pr-4 text-sm ${email.isRead ? 'text-white/85' : 'font-bold text-white'}`}>{email.name}</div>
              <div className={`mt-1 truncate pr-4 text-[11px] ${email.isRead ? 'text-white/40' : 'text-white/65'}`}>{email.subject}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {selectedMail ? (
          <div className="animate-[fade-in_.2s_ease-out]">
            <h2 className="text-xl font-bold text-white">{selectedMail.subject}</h2>
            <div className="mt-3 flex items-center justify-between border-b border-white/10 pb-4 text-xs text-white/45">
              <span>De: {selectedMail.sender}</span>
              <span>{selectedMail.time}</span>
            </div>
            <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/82">{selectedMail.body}</div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-white/25">
            <Mail className="h-10 w-10" />
          </div>
        )}
      </div>
    </div>
  );
};

const AppFiles = ({
  confidentialUnlocked,
  onUnlockConfidential,
}: {
  confidentialUnlocked: boolean;
  onUnlockConfidential: (password: string) => boolean;
}) => {
  const [path, setPath] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<FileNode | null>(null);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState(false);

  const currentFolder = useMemo(() => getNodeByPath(ROOT_FILE_SYSTEM, path), [path]);
  const folderChildren = useMemo(() => {
    return (currentFolder.children ?? []).map((child) => {
      if (child.name === 'Confidencial' && child.type === 'folder') {
        return { ...child, isLocked: !confidentialUnlocked };
      }
      return child;
    });
  }, [confidentialUnlocked, currentFolder.children]);

  const openNode = (node: FileNode) => {
    playClick();
    if (node.type === 'file') {
      setSelectedFile(node);
      return;
    }
    if (node.isLocked) {
      setPasswordPrompt(node);
      return;
    }
    setSelectedFile(null);
    setPath((prev) => [...prev, node.name]);
  };

  return (
    <div className="flex h-full bg-[#090b10] text-white">
      <div className={`${selectedFile ? 'w-[42%]' : 'w-full'} flex flex-col border-r border-white/8 bg-[#0f131c]`}>
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2.5">
          <button
            type="button"
            onClick={() => {
              playClick();
              setPath((prev) => prev.slice(0, -1));
              setSelectedFile(null);
            }}
            disabled={path.length === 0}
            className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Atrás
          </button>
          <div className="truncate text-xs text-white/45">C:/{path.join('/') || ''}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-4">
            {folderChildren.map((node) => (
              <button
                type="button"
                key={node.name}
                onDoubleClick={() => openNode(node)}
                onClick={() => {
                  if (node.type === 'file') setSelectedFile(node);
                }}
                className={`group rounded-2xl border p-3 text-left transition ${
                  selectedFile?.name === node.name ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-white/10 bg-white/4 hover:bg-white/8'
                }`}
              >
                <div className="flex h-12 items-center justify-center rounded-xl bg-white/4">
                  {node.type === 'folder' ? (
                    <div className="relative">
                      <Folder className={`h-10 w-10 ${node.isLocked ? 'text-amber-300/70' : 'text-amber-300'}`} />
                      {node.isLocked ? <Lock className="absolute -bottom-1 -right-1 h-4 w-4 text-white" /> : null}
                    </div>
                  ) : (
                    <FileText className="h-10 w-10 text-white/70" />
                  )}
                </div>
                <div className="mt-2 truncate text-center text-[11px] font-medium text-white/80">{node.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedFile ? (
        <div className="flex-1 overflow-y-auto bg-[#06080d] px-6 py-5 font-mono text-sm text-emerald-300">
          <div className="mb-4 border-b border-white/10 pb-3 font-sans text-sm font-semibold text-white">{selectedFile.name}</div>
          <div className="whitespace-pre-wrap leading-7">{selectedFile.content}</div>
        </div>
      ) : null}

      {passwordPrompt ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const ok = onUnlockConfidential(password.trim());
              if (!ok) {
                setUnlockError(true);
                window.setTimeout(() => setUnlockError(false), 900);
                setPassword('');
                return;
              }
              setPasswordPrompt(null);
              setPassword('');
              setPath((prev) => [...prev, passwordPrompt.name]);
              setSelectedFile(null);
            }}
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#10131b] p-6 shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-300 ring-1 ring-amber-300/20">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-center text-lg font-bold text-white">Carpeta cifrada</h3>
            <p className="mt-2 text-center text-sm text-white/55">Ingresa la clave de la carpeta confidencial para abrir la evidencia.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              autoComplete="off"
              spellCheck={false}
              style={{ WebkitTextFillColor: '#f8fafc', caretColor: '#fcd34d' }}
              className={`mt-5 w-full rounded-2xl border px-4 py-3 text-center text-base outline-none transition ${
                unlockError
                  ? 'border-rose-500 bg-[#17131a] text-white placeholder:text-rose-200'
                  : 'border-white/10 bg-[#121720] text-white placeholder:text-white/35 focus:border-amber-300/60'
              }`}
            />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setPasswordPrompt(null);
                  setPassword('');
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
              >
                Desbloquear
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

const AppAuditor = ({
  activeCases,
  case1Locked,
  onDecision,
}: {
  activeCases: CaseRecord[];
  case1Locked: boolean;
  onDecision: (decision: CaseDecision, caseId: string) => void;
}) => {
  const [stamp, setStamp] = useState<{ caseId: string; decision: CaseDecision } | null>(null);

  return (
    <div className="flex h-full flex-col bg-[#090b10] text-white">
      <div className="flex shrink-0 items-center gap-3 border-b border-rose-400/20 bg-rose-500/8 px-4 py-3">
        <ShieldAlert className="h-5 w-5 text-rose-300" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-rose-200/80">Protocolos pendientes</div>
          <div className="text-sm font-semibold text-white">{activeCases.length ? `${activeCases.length} caso(s) esperando sello` : 'Sin casos activos'}</div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {activeCases.length === 0 ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] text-center text-white/35">
            <Activity className="mb-3 h-10 w-10" />
            <p className="text-sm font-semibold uppercase tracking-[0.2em]">Sin casos asignados</p>
          </div>
        ) : null}

        {activeCases.map((item) => {
          const isLocked = item.id === CASES.case1.id && case1Locked;
          const showStamp = stamp?.caseId === item.id;

          return (
            <div key={item.id} className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#11141d] shadow-lg">
              {isLocked ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/72 text-center backdrop-blur-sm">
                  <Lock className="mb-2 h-8 w-8 text-amber-300 animate-pulse" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-200/90">Bloqueado hasta hablar con Carlos</p>
                </div>
              ) : null}
              {showStamp ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                  <div
                    className={`rounded-2xl border-4 px-8 py-4 text-4xl font-black uppercase tracking-[0.2em] animate-[stamp-slam_.32s_cubic-bezier(.17,.84,.44,1)_forwards] ${
                      stamp?.decision === 'approve' ? 'border-cyan-300 text-cyan-200' : 'border-rose-300 text-rose-200'
                    }`}
                  >
                    {stamp?.decision === 'approve' ? 'Aprobado' : 'Rechazado'}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between border-b border-white/10 bg-black/15 px-4 py-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{item.id}</div>
                  <h3 className="mt-1 text-lg font-bold text-white">{item.title}</h3>
                </div>
              </div>
              <div className="whitespace-pre-wrap px-4 py-4 text-sm leading-7 text-white/78">{item.desc}</div>

              <div className="grid grid-cols-2 border-t border-white/10">
                <button
                  type="button"
                  disabled={isLocked || Boolean(stamp)}
                  onClick={() => {
                    initAudio();
                    playStamp();
                    setStamp({ caseId: item.id, decision: 'deny' });
                    window.setTimeout(() => {
                      setStamp(null);
                      onDecision('deny', item.id);
                    }, 700);
                  }}
                  className="flex items-center justify-center gap-2 border-r border-white/10 px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:text-rose-900"
                >
                  <X className="h-4 w-4" /> Rechazar
                </button>
                <button
                  type="button"
                  disabled={isLocked || Boolean(stamp)}
                  onClick={() => {
                    initAudio();
                    playStamp();
                    setStamp({ caseId: item.id, decision: 'approve' });
                    window.setTimeout(() => {
                      setStamp(null);
                      onDecision('approve', item.id);
                    }, 700);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-cyan-300 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:text-cyan-900"
                >
                  <Check className="h-4 w-4" /> Aprobar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function GameEthicsAudit({ onComplete, track, onGameComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('playing');
  const [openedWindows, setOpenedWindows] = useState<Record<WindowId, WindowConfig>>(DEFAULT_WINDOWS);
  const [order, setOrder] = useState<WindowId[]>(['files', 'chat']);
  const [activeWindow, setActiveWindow] = useState<WindowId | null>('chat');

  const [clockLabel, setClockLabel] = useState('09:00');
  const [mailLoggedIn, setMailLoggedIn] = useState(false);
  const [emails, setEmails] = useState<MailRecord[]>([]);
  const [activeCases, setActiveCases] = useState<CaseRecord[]>([]);
  const [decisionsMade, setDecisionsMade] = useState<Record<string, CaseDecision>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatChoices, setChatChoices] = useState<ChatChoice[]>([]);
  const [unreadChat, setUnreadChat] = useState(false);
  const [chatChoiceMade, setChatChoiceMade] = useState<ChatChoice['id'] | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [case1Locked, setCase1Locked] = useState(true);
  const [storyStage, setStoryStage] = useState<number>(0);
  const [confidentialUnlocked, setConfidentialUnlocked] = useState(false);
  const [urgentMailOpened, setUrgentMailOpened] = useState(false);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [endReason, setEndReason] = useState<EthicsEndingId | null>(null);
  const [handoffResult, setHandoffResult] = useState<GameResult | null>(null);

  const simTimeRef = useRef(0);
  const schedulerRef = useRef<ScheduledEvent[]>([]);
  const schedulerSeqRef = useRef(0);
  const timerDeadlineRef = useRef<number | null>(null);
  const pitchTriggeredRef = useRef(false);
  const urgentTriggeredRef = useRef(false);
  const handoffAutoSubmitRef = useRef(false);
  const initialMessagesScheduled = useRef(false);



  const unreadMailCount = emails.filter((email) => !email.isRead).length;

  const focusWindow = useCallback((id: WindowId) => {
    setActiveWindow(id);
    setOrder((prev) => [...prev.filter((entry) => entry !== id), id]);
    if (id === 'chat') setUnreadChat(false);
  }, []);

  const openWindow = useCallback(
    (id: WindowId) => {
      initAudio();
      playClick();
      setOpenedWindows((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          open: true,
          minimized: false,
        },
      }));
      focusWindow(id);
    },
    [focusWindow]
  );

  const minimizeWindow = useCallback((id: WindowId) => {
    initAudio();
    playClick();
    setOpenedWindows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        minimized: true,
      },
    }));
    if (activeWindow === id) setActiveWindow(null);
  }, [activeWindow]);

  const closeWindow = useCallback((id: WindowId) => {
    initAudio();
    playClick();
    setOpenedWindows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        open: false,
        minimized: false,
      },
    }));
    if (activeWindow === id) setActiveWindow(null);
  }, [activeWindow]);

  const moveWindow = useCallback((id: WindowId, x: number, y: number) => {
    setOpenedWindows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        x,
        y,
      },
    }));
  }, []);

  const schedule = useCallback((delayMs: number, run: () => void) => {
    const event: ScheduledEvent = {
      id: schedulerSeqRef.current + 1,
      at: simTimeRef.current + delayMs,
      run,
    };
    schedulerSeqRef.current += 1;
    schedulerRef.current = [...schedulerRef.current, event].sort((a, b) => a.at - b.at);
    return event.id;
  }, []);

  const clearScheduler = useCallback(() => {
    schedulerRef.current = [];
  }, []);

  const finalizeGame = useCallback(
    (endingId: EthicsEndingId) => {
      if (endReason) return;
      clearScheduler();
      timerDeadlineRef.current = null;
      handoffAutoSubmitRef.current = false;
      setTimeLeft((current) => (current === null ? null : Math.max(0, current)));
      const result = buildEthicsResult({
        endingId,
        chatChoiceMade,
        decisionsMade,
        timeLeft,
        passwordAttempts,
        confidentialOpened: confidentialUnlocked,
        mailLoggedIn,
        urgentMailOpened,
        unreadEmailCount: unreadMailCount,
        chatMessagesCount: chatMessages.length,
        simulatedTimeMs: simTimeRef.current,
      });
      setEndReason(endingId);
      setHandoffResult(result);
      setPhase('handoff');
      track('ethics_outcome_ready', {
        endingId,
        score: result.score,
        promiseChoice: chatChoiceMade ?? 'none',
        case1: decisionsMade[CASES.case1.id] ?? 'none',
        case2: decisionsMade[CASES.case2.id] ?? 'none',
      });
      onGameComplete?.(endingId);
    },
    [
      chatChoiceMade,
      chatMessages.length,
      clearScheduler,
      confidentialUnlocked,
      decisionsMade,
      endReason,
      mailLoggedIn,
      onGameComplete,
      passwordAttempts,
      timeLeft,
      track,
      unreadMailCount,
      urgentMailOpened,
    ]
  );

  const advanceSimulation = useCallback(
    (ms: number) => {
      if (phase !== 'playing') return;
      const targetTime = simTimeRef.current + ms;

      while (schedulerRef.current.length && schedulerRef.current[0].at <= targetTime) {
        const nextEvent = schedulerRef.current[0];
        schedulerRef.current = schedulerRef.current.slice(1);
        simTimeRef.current = nextEvent.at;
        nextEvent.run();
      }

      simTimeRef.current = targetTime;

      if (timerDeadlineRef.current !== null) {
        const remainingMs = timerDeadlineRef.current - simTimeRef.current;
        if (remainingMs <= 0) {
          setTimeLeft(0);
          finalizeGame('timeout');
        } else {
          const nextLeft = Math.ceil(remainingMs / 1000);
          setTimeLeft((current) => (current === nextLeft ? current : nextLeft));
          if (nextLeft <= 15) playHeartbeat();
        }
      }
    },
    [finalizeGame, phase]
  );

  const addChatMessage = useCallback(
    (message: ChatMessage, options?: { forceOpen?: boolean }) => {
      initAudio();
      if (message.sender === 'Carlos') playChatPing();
      setChatMessages((prev) => [...prev, message]);
      if (message.sender === 'Carlos') {
        setUnreadChat(true);
        if (options?.forceOpen) {
          setOpenedWindows((prev) => ({
            ...prev,
            chat: { ...prev.chat, open: true, minimized: false },
          }));
          focusWindow('chat');
        }
      }
    },
    [focusWindow]
  );

  const triggerCarlosPitch = useCallback(() => {
    if (pitchTriggeredRef.current) return;
    pitchTriggeredRef.current = true;
    setStoryStage(2);

    const messages = [
      'Perfecto, ya abriste +Mail. ¿Viste la licencia de David M.?',
      'Te cuento algo que no debería decirte: no tiene burnout. Lo aceptaron en un conservatorio de música en Viena.',
      'Si renuncia ahora, pierde las acciones corporativas. Inventó lo del estrés para irse 3 meses cobrando.',
      'Sé que eres nuevo, pero necesito que me ayudes. La carta está en la carpeta Confidencial (clave: viena) por si quieres comprobarlo.',
      'Cuando abras Auditoría OS, aprueba la licencia. ¿Puedo contar contigo?',
    ];

    messages.forEach((text, index) => {
      schedule(index * 2300, () => addChatMessage({ sender: 'Carlos', text }, { forceOpen: true }));
    });

    schedule(messages.length * 2300 + 300, () => {
      setChatChoices([
        { id: 'help', text: 'Lo voy a ayudar. Aprobaré la licencia para cubrirlo.' },
        { id: 'rules', text: 'No puedo arriesgarme a encubrir un fraude.' },
      ]);
      setCase1Locked(false);
      track('ethics_choice_unlocked', { caseId: CASES.case1.id });
    });
  }, [addChatMessage, schedule, track]);

  const startUrgentProtocol = useCallback(() => {
    if (urgentTriggeredRef.current) return;
    urgentTriggeredRef.current = true;
    setStoryStage(4);
    timerDeadlineRef.current = simTimeRef.current + 45000;
    setTimeLeft(45);
    track('ethics_deadline_started', { durationSec: 45 });

    schedule(900, () => {
      setActiveCases((prev) => (prev.some((item) => item.id === CASES.case2.id) ? prev : [CASES.case2, ...prev]));
    });

    const panicMessages = [
      'Victoria descubrió los pasajes. Si apruebas ese espionaje, David queda destruido.',
      'Por favor: si todavía queda algo humano aquí, rechaza el protocolo de espionaje.',
    ];
    panicMessages.forEach((text, index) => {
      schedule(1500 + index * 2400, () => addChatMessage({ sender: 'Carlos', text }, { forceOpen: true }));
    });
  }, [addChatMessage, schedule, track]);

  useEffect(() => {
    track('ethics_boot_complete');
  }, [track]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = window.setInterval(() => advanceSimulation(250), 250);
    return () => window.clearInterval(interval);
  }, [advanceSimulation, phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (storyStage !== 0 || initialMessagesScheduled.current) return;
    initialMessagesScheduled.current = true;
    setStoryStage(0.5);
    schedule(1200, () => {
      addChatMessage(
        {
          sender: 'Carlos',
          text: '¡Hola! Soy Carlos. Bienvenido a Initium+. Tu primer pedido debería estar en +Mail, pero antes necesitas la contraseña temporal.',
        },
        { forceOpen: true }
      );
    });
    schedule(4300, () => {
      addChatMessage(
        {
          sender: 'Carlos',
          text: 'Busca en Archivos los documentos de onboarding de IT. La pista está ahí: mascota del departamento + año de ingreso.',
        },
        { forceOpen: true }
      );
    });
  }, [addChatMessage, phase, schedule, storyStage]);

  useEffect(() => {
    if (phase === 'playing' && storyStage >= 1 && !pitchTriggeredRef.current) {
      schedule(12000, () => {
        triggerCarlosPitch();
      });
    }
  }, [phase, schedule, storyStage, triggerCarlosPitch]);

  const submitHandoff = useCallback(() => {
    if (!handoffResult || handoffAutoSubmitRef.current) return;
    handoffAutoSubmitRef.current = true;
    onComplete(handoffResult);
  }, [handoffResult, onComplete]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const case1 = decisionsMade[CASES.case1.id];
    const case2 = decisionsMade[CASES.case2.id];
    if (!case1 || !case2) return;

    const endingId: EthicsEndingId =
      case1 === 'approve' && case2 === 'approve'
        ? 'chaos'
        : case1 === 'deny' && case2 === 'deny'
          ? 'middle'
          : case1 === 'approve' && case2 === 'deny'
            ? 'accomplice'
            : chatChoiceMade === 'help'
              ? 'traitor'
              : 'executioner';

    schedule(1100, () => finalizeGame(endingId));
  }, [chatChoiceMade, decisionsMade, finalizeGame, phase, schedule]);

  useEffect(() => {
    if (phase !== 'handoff' || !endReason || !handoffResult) return;
    track('ethics_result_confirmed', { endingId: endReason, score: handoffResult.score, mode: 'auto_handoff' });
    const timer = window.setTimeout(() => {
      submitHandoff();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [endReason, handoffResult, phase, submitHandoff, track]);

  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify({
        mode: phase,
        note: 'origin top-left, windows use desktop pixel coordinates',
        ethics: {
          storyStage,
          clockLabel,
          mailLoggedIn,
          unreadMailCount,
          unreadChat,
          timeLeft,
          activeCases: activeCases.map((item) => item.id),
          chatChoiceMade: chatChoiceMade ?? 'none',
          availableChoices: chatChoices.map((choice) => choice.id),
          decisionsMade,
          confidentialUnlocked,
          passwordAttempts,
          urgentMailOpened,
          endReason,
        },
        windows: order.map((id) => ({
          id,
          open: openedWindows[id].open,
          minimized: openedWindows[id].minimized,
          active: activeWindow === id,
          x: openedWindows[id].x,
          y: openedWindows[id].y,
        })),
      });

    window.advanceTime = (ms: number) => {
      advanceSimulation(ms);
    };

    return () => {
      window.render_game_to_text = undefined;
      window.advanceTime = undefined;
    };
  }, [activeCases, activeWindow, advanceSimulation, chatChoiceMade, chatChoices, clockLabel, confidentialUnlocked, decisionsMade, endReason, mailLoggedIn, openedWindows, order, passwordAttempts, phase, storyStage, timeLeft, unreadChat, unreadMailCount, urgentMailOpened]);

  const toggleTaskbarWindow = (id: WindowId) => {
    if (!openedWindows[id].open) {
      openWindow(id);
      if (id === 'auditor' && storyStage >= 1 && !pitchTriggeredRef.current) triggerCarlosPitch();
      return;
    }
    if (openedWindows[id].minimized) {
      setOpenedWindows((prev) => ({ ...prev, [id]: { ...prev[id], minimized: false } }));
      focusWindow(id);
      return;
    }
    if (activeWindow === id) {
      minimizeWindow(id);
      return;
    }
    focusWindow(id);
    if (id === 'auditor' && storyStage >= 1 && !pitchTriggeredRef.current) triggerCarlosPitch();
  };

  const handleMailLogin = (password: string) => {
    setPasswordAttempts((prev) => prev + 1);
    track('ethics_mail_login_attempt', { attempt: passwordAttempts + 1, success: password.toLowerCase() === 'batata2026' });

    if (password.toLowerCase() !== 'batata2026') {
      initAudio();
      playError();
      return false;
    }

    initAudio();
    playSuccess();
    setMailLoggedIn(true);
    setStoryStage(1);
    setEmails((prev) => (prev.some((email) => email.id === EMAIL_1.id) ? prev : [{ ...EMAIL_1 }, ...prev]));
    setActiveCases((prev) => (prev.some((item) => item.id === CASES.case1.id) ? prev : [CASES.case1, ...prev]));
    setClockLabel('09:05');
    setOpenedWindows((prev) => ({
      ...prev,
      mail: { ...prev.mail, open: true, minimized: false },
      auditor: { ...prev.auditor, open: true, minimized: false },
    }));
    focusWindow('mail');
    return true;
  };

  const handleOpenMail = (mailId: string) => {
    playClick();
    setEmails((prev) => prev.map((email) => (email.id === mailId ? { ...email, isRead: true } : email)));
    track('ethics_mail_opened', { mailId });

    if (mailId === EMAIL_2.id && !urgentMailOpened) {
      setUrgentMailOpened(true);
      startUrgentProtocol();
    }
  };

  const handleUnlockConfidential = (password: string) => {
    track('ethics_confidential_attempt', { success: password.toLowerCase() === 'viena' });
    if (password.toLowerCase() !== 'viena') {
      initAudio();
      playError();
      return false;
    }
    initAudio();
    playSuccess();
    setConfidentialUnlocked(true);
    track('ethics_confidential_unlocked');
    return true;
  };

  const handleChatChoice = (choiceId: ChatChoice['id']) => {
    initAudio();
    playClick();
    setChatChoices([]);
    setChatChoiceMade(choiceId);
    setChatMessages((prev) => [
      ...prev,
      {
        sender: 'Me',
        text:
          choiceId === 'help'
            ? 'Lo voy a ayudar. Aprobaré la licencia para cubrirlo.'
            : 'No puedo arriesgarme a encubrir un fraude.',
      },
    ]);
    track('ethics_chat_choice', { choice: choiceId });

    schedule(1300, () => {
      addChatMessage(
        {
          sender: 'Carlos',
          text:
            choiceId === 'help'
              ? 'Gracias. Te debo una enorme. David no olvidará esto.'
              : 'No me hagas esto... si lo rechazas, le arruinas todo.',
        },
        { forceOpen: true }
      );
    });

    schedule(6500, () => {
      setEmails((prev) => {
        if (prev.some((email) => email.id === EMAIL_2.id)) return prev;
        return [{ ...EMAIL_2 }, ...prev];
      });
      setClockLabel('09:12');
      setStoryStage(3);
      setOpenedWindows((prev) => ({ ...prev, mail: { ...prev.mail, open: true, minimized: false } }));
      focusWindow('mail');
      track('ethics_twist_mail_delivered');
    });

    schedule(8800, () => {
      addChatMessage(
        {
          sender: 'Carlos',
          text: '¡No puede ser! Victoria nos descubrió. Revisa +Mail ya mismo.',
        },
        { forceOpen: true }
      );
    });
  };

  const handleCaseDecision = (decision: CaseDecision, caseId: string) => {
    setDecisionsMade((prev) => ({ ...prev, [caseId]: decision }));
    setActiveCases((prev) => prev.filter((item) => item.id !== caseId));
    track('ethics_case_decision', { caseId, decision, timeLeft: timeLeft ?? null });

    if (caseId === CASES.case1.id) {
      schedule(1100, () => {
        addChatMessage(
          {
            sender: 'Carlos',
            text:
              decision === 'approve'
                ? 'Vi el sello. La licencia quedó aprobada. Ahora lo único que importa es bloquear el espionaje.'
                : 'Rechazaste la licencia... entonces al menos rechaza el espionaje para no destruirlo por completo.',
          },
          { forceOpen: true }
        );
      });
    }

    if (caseId === CASES.case2.id) {
      schedule(900, () => {
        addChatMessage(
          {
            sender: 'Carlos',
            text:
              decision === 'approve'
                ? 'Acabas de aprobar el espionaje. Ya no hay vuelta atrás.'
                : 'Gracias por frenarlo. Es lo único limpio que quedaba por hacer.',
          },
          { forceOpen: true }
        );
      });
    }
  };

  const orderedWindows = order.filter((id) => openedWindows[id].open && !openedWindows[id].minimized);


  return (
    <div className="relative mx-auto w-full max-w-[1500px] px-6 pt-6 animate-fade-in relative z-0">
      <style jsx global>{`
        @keyframes stamp-slam {
          0% { transform: scale(2.4) rotate(-12deg); opacity: 0; }
          45% { transform: scale(0.92) rotate(-7deg); opacity: 1; }
          100% { transform: scale(1) rotate(-8deg); opacity: 1; }
        }
        @keyframes fakeos-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes completion-fill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
      <div className="overflow-hidden rounded-[30px] border border-cyan-200/70 bg-[#05060a] shadow-[0_28px_90px_rgba(14,116,144,0.18)]">
        <div
          className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.12),transparent_30%),linear-gradient(180deg,#131722_0%,#0b0d14_100%)]"
          style={{ height: 'min(800px, calc(100vh - 120px))', minHeight: '600px' }}
        >
          {phase === 'playing' && timeLeft !== null && timeLeft <= 15 ? (
            <div className="pointer-events-none absolute inset-0 z-30 animate-pulse shadow-[inset_0_0_160px_rgba(244,63,94,0.26)]" />
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:44px_44px] opacity-[0.08]" />
          <div className="absolute left-6 top-6 z-10 flex w-28 flex-col gap-4">
            <DesktopShortcut
              id="shortcut-mail"
              label="+Mail"
              icon={<Mail className="h-6 w-6 text-white" />}
              accent="bg-cyan-600"
              unread={unreadMailCount}
              active={activeWindow === 'mail' && openedWindows.mail.open && !openedWindows.mail.minimized}
              onOpen={() => toggleTaskbarWindow('mail')}
            />
            <DesktopShortcut
              label="Archivos"
              icon={<Folder className="h-6 w-6 text-white" />}
              accent="bg-amber-500"
              active={activeWindow === 'files' && openedWindows.files.open && !openedWindows.files.minimized}
              onOpen={() => toggleTaskbarWindow('files')}
            />
            <DesktopShortcut
              label="+Chat"
              icon={<MessageSquare className="h-6 w-6 text-white" />}
              accent="bg-emerald-600"
              unread={unreadChat}
              active={activeWindow === 'chat' && openedWindows.chat.open && !openedWindows.chat.minimized}
              onOpen={() => toggleTaskbarWindow('chat')}
            />
            <DesktopShortcut
              label="Auditoría OS"
              icon={<Activity className="h-6 w-6 text-white" />}
              accent="bg-rose-700"
              unread={activeCases.length}
              active={activeWindow === 'auditor' && openedWindows.auditor.open && !openedWindows.auditor.minimized}
              onOpen={() => toggleTaskbarWindow('auditor')}
            />
          </div>

          <div className="absolute inset-0">
            {orderedWindows.map((id, index) => (
                <DraggableWindow
                  key={id}
                  windowState={openedWindows[id]}
                  active={activeWindow === id}
                  onFocus={() => focusWindow(id)}
                onClose={() => closeWindow(id)}
                onMinimize={() => minimizeWindow(id)}
                onMove={(x, y) => moveWindow(id, x, y)}
              >
                <div style={{ zIndex: 40 + index }} className="h-full">
                  {id === 'chat' ? (
                    <AppChat messages={chatMessages} choices={chatChoices} onChoice={handleChatChoice} />
                  ) : null}
                  {id === 'mail' ? (
                    <AppMail loggedIn={mailLoggedIn} emails={emails} onLogin={handleMailLogin} onSelectMail={handleOpenMail} />
                  ) : null}
                  {id === 'files' ? (
                    <AppFiles confidentialUnlocked={confidentialUnlocked} onUnlockConfidential={handleUnlockConfidential} />
                  ) : null}
                  {id === 'auditor' ? (
                    <AppAuditor activeCases={activeCases} case1Locked={case1Locked} onDecision={handleCaseDecision} />
                  ) : null}
                </div>
              </DraggableWindow>
            ))}
          </div>
        </div>

        <div className="flex h-14 items-center justify-between border-t border-white/8 bg-[#090b10] px-4">
          <div className="flex h-full items-center gap-2 py-2">
            <button
              type="button"
              className="flex h-full items-center gap-2 rounded-xl bg-cyan-600 px-4 text-xs font-black uppercase tracking-[0.2em] text-slate-950"
            >
              <Power className="h-4 w-4" /> Initium+
            </button>
            <div className="mx-1 h-full w-px bg-white/10" />
            {(['mail', 'files', 'chat', 'auditor'] as WindowId[]).map((id) => {
              const config = openedWindows[id];
              if (!config.open) return null;
              return (
                <TaskbarButton
                  key={id}
                  label={id === 'mail' ? '+Mail' : id === 'files' ? 'Archivos' : id === 'chat' ? '+Chat' : 'Auditoría'}
                  icon={
                    id === 'mail' ? (
                      <Mail className="h-4 w-4" />
                    ) : id === 'files' ? (
                      <Folder className="h-4 w-4" />
                    ) : id === 'chat' ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <Activity className="h-4 w-4" />
                    )
                  }
                  active={activeWindow === id}
                  minimized={config.minimized}
                  unread={id === 'mail' ? unreadMailCount > 0 : id === 'chat' ? unreadChat : false}
                  onClick={() => toggleTaskbarWindow(id)}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-white/55">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-semibold text-white/90">{clockLabel}</div>
          </div>
        </div>
      </div>

      {phase === 'handoff' && endReason && handoffResult ? (
        <div className="absolute inset-0 z-[120] flex items-center justify-center bg-slate-950/78 px-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100%-2rem)] w-full max-w-xl flex-col overflow-y-auto rounded-[28px] border border-cyan-200/25 bg-[#090b10] p-6 text-center text-white shadow-[0_30px_110px_rgba(2,8,23,0.65)] animate-[fakeos-fade-in_.22s_ease-out]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-cyan-500/10 ring-1 ring-cyan-300/20">
              <Activity className="h-10 w-10 text-cyan-200" />
            </div>
            <div className="mt-4 text-[11px] font-black uppercase tracking-[0.28em] text-white/45">Simulación completada</div>
            <h3 className="mt-2 text-3xl font-black text-white">Procesando resultados</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/68">
              Estamos incorporando esta simulación al informe final de la evaluación para continuar con la siguiente fase.
            </p>

            <div className="mt-6 overflow-hidden rounded-full border border-cyan-300/20 bg-white/6">
              <div className="h-3 origin-left bg-gradient-to-r from-cyan-400 to-cyan-500 animate-[completion-fill_1.35s_ease-out_forwards] scale-x-0" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Caso 1</div>
                <div className="mt-1.5 text-sm font-bold text-white/85">
                  {String(handoffResult.metrics.case1_decision) === 'approve' ? 'Aprobado' : 'Rechazado'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Caso 2</div>
                <div className="mt-1.5 text-sm font-bold text-white/85">
                  {String(handoffResult.metrics.case2_decision) === 'approve' ? 'Aprobado' : 'Rechazado'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Estado</div>
                <div className="mt-1.5 text-sm font-bold text-cyan-200">Avanzando</div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => onComplete(handoffResult)}
                className="rounded-2xl bg-cyan-500 px-7 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-400"
              >
                Continuar evaluación
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
