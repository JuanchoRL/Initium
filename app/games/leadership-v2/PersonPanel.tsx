import React, { useEffect, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { clsx } from 'clsx';
import { AlertOctagon, Brain, Heart, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import type { Person, PersonState, Task } from './types';

interface Props {
  person: Person;
  state: PersonState;
  isOver: boolean;
}

const FaceAvatar = ({ mood, colorClass, id }: { mood: string; colorClass: string; id: string }) => {
  const mouthPaths = {
    happy: 'M 25 55 C 33.3 55, 41.6 55, 50 55 C 58.3 55, 66.6 55, 75 55 C 75 68.8, 63.8 80, 50 80 C 36.2 80, 25 68.8, 25 55 Z',
    neutral: 'M 30 65 C 30 62.8, 38.9 61, 50 61 C 61.1 61, 70 62.8, 70 65 C 70 67.2, 61.1 69, 50 69 C 38.9 69, 30 67.2, 30 65 Z',
    stressed: 'M 30 70 C 30 58.9, 38.9 50, 50 50 C 61.1 50, 70 58.9, 70 70 C 63.3 70, 56.6 70, 50 70 C 43.3 70, 36.6 70, 30 70 Z',
    burnout: 'M 40 65 C 40 59.5, 44.5 55, 50 55 C 55.5 55, 60 59.5, 60 65 C 60 70.5, 55.5 75, 50 75 C 44.5 75, 40 70.5, 40 65 Z',
  } as const;

  const eyeScales = {
    happy: 1,
    neutral: 1,
    stressed: 0.85,
    burnout: 0.2,
  } as const;

  const eyeY = {
    happy: 0,
    neutral: 0,
    stressed: -2,
    burnout: 4,
  } as const;

  const safeMood = (mood in mouthPaths ? mood : 'neutral') as keyof typeof mouthPaths;

  return (
    <motion.svg
      viewBox="0 0 100 100"
      className={clsx('w-14 h-14 transition-colors duration-500', colorClass)}
      animate={safeMood === 'stressed' ? { x: [-1, 2, -1.5, 1.5, -1] } : { x: 0 }}
      transition={safeMood === 'stressed' ? { repeat: Infinity, duration: 0.4 } : { duration: 0.3 }}
    >
      <defs>
        <linearGradient id={`faceGrad-${id}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="50" fill={`url(#faceGrad-${id})`} />

      <motion.circle
        cx="32"
        cy="42"
        r="7"
        fill="currentColor"
        animate={{ scaleY: eyeScales[safeMood], y: eyeY[safeMood] }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ transformOrigin: '32px 42px' }}
      />

      <motion.circle
        cx="68"
        cy="42"
        r="7"
        fill="currentColor"
        animate={{ scaleY: eyeScales[safeMood], y: eyeY[safeMood] }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{ transformOrigin: '68px 42px' }}
      />

      <path d={mouthPaths[safeMood]} fill="currentColor" />

      <motion.path
        d="M 80 20 Q 85 30 80 35 Q 75 30 80 20 Z"
        fill="#60A5FA"
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: safeMood === 'stressed' ? 1 : 0,
          scale: safeMood === 'stressed' ? 1 : 0,
          y: safeMood === 'stressed' ? [0, 6, 0] : 0,
        }}
        transition={{
          y: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
          default: { duration: 0.3 },
        }}
        style={{ transformOrigin: '80px 27px' }}
      />
    </motion.svg>
  );
};

function MiniBar({ icon: Icon, value }: { icon: React.ComponentType<{ className?: string }>; value: number }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value > prevValue.current) {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 500);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
    prevValue.current = value;
  }, [value]);

  let gradientClass = 'from-emerald-400 to-emerald-500';
  let iconColor = 'text-emerald-500';

  if (value >= 80) {
    gradientClass = 'from-red-400 to-red-500';
    iconColor = 'text-red-500';
  } else if (value >= 50) {
    gradientClass = 'from-amber-400 to-amber-500';
    iconColor = 'text-amber-500';
  }

  return (
    <div className={clsx('flex items-center gap-2 transition-transform duration-300', isUpdating && 'scale-[1.05]')}>
      <Icon className={clsx('w-4 h-4 shrink-0 transition-colors duration-300', iconColor, isUpdating && 'animate-bounce text-cyan-600')} />
      <div
        className={clsx(
          'flex-1 relative h-3.5 bg-slate-100 rounded-full overflow-hidden shadow-inner transition-all duration-300',
          isUpdating && 'ring-4 ring-cyan-400/60 ring-offset-1 scale-[1.02]'
        )}
      >
        <div
          className={clsx('h-full transition-all duration-700 ease-out rounded-full bg-gradient-to-r', gradientClass, isUpdating && 'brightness-125')}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-800 mix-blend-overlay">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

function AssignedTaskItem({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        'bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-sm font-semibold text-slate-700 truncate hover:border-cyan-200 transition-colors cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-90 border-cyan-400 shadow-xl ring-2 ring-cyan-300'
      )}
      title={task.title}
    >
      {task.title}
    </div>
  );
}

export function PersonPanel({ person, state, isOver }: Props) {
  const { setNodeRef } = useDroppable({ id: person.id });

  const [justDropped, setJustDropped] = useState(false);
  const prevTaskCount = useRef(state.assignedTasks.length);

  useEffect(() => {
    if (state.assignedTasks.length > prevTaskCount.current) {
      setJustDropped(true);
      const timer = setTimeout(() => setJustDropped(false), 400);
      prevTaskCount.current = state.assignedTasks.length;
      return () => clearTimeout(timer);
    }
    prevTaskCount.current = state.assignedTasks.length;
  }, [state.assignedTasks.length]);

  const isOverloaded = person.hard_constraints?.max_active_tasks
    ? state.assignedTasks.length > person.hard_constraints.max_active_tasks
    : false;

  const taskCount = state.assignedTasks.length;
  const maxFatigue = Math.max(state.fatigue_cognitive, state.fatigue_emotional, state.fatigue_time);

  let mood = 'happy';
  if (taskCount >= 2 || maxFatigue > 50) mood = 'neutral';
  if (taskCount >= 3 || maxFatigue > 80) mood = 'stressed';
  if (taskCount >= 4 || maxFatigue >= 100) mood = 'burnout';

  const isBurnout = mood === 'burnout';

  let avatarColor = 'text-cyan-600';
  if (mood === 'neutral') avatarColor = 'text-amber-500';
  if (mood === 'stressed') avatarColor = 'text-orange-500';
  if (isBurnout) avatarColor = 'text-red-500';

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'rounded-[2rem] p-5 border-2 transition-all duration-300 flex flex-col h-full min-w-[300px] relative overflow-hidden',
        isBurnout
          ? 'bg-red-50 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
          : isOver
            ? 'border-cyan-400 bg-cyan-50/50 shadow-lg scale-[1.02]'
            : 'bg-white border-slate-100 shadow-sm hover:shadow-md',
        isOverloaded && !isBurnout && 'border-red-400 bg-red-50/50 shadow-[0_0_15px_rgba(248,113,113,0.2)]',
        justDropped && !isBurnout && 'ring-4 ring-cyan-500/40 scale-[1.03] shadow-xl bg-cyan-50/30'
      )}
    >
      {isOverloaded && !isBurnout && (
        <div className="absolute top-0 left-0 w-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold text-center py-1.5 uppercase tracking-widest z-20 flex items-center justify-center gap-1 shadow-md animate-pulse">
          <AlertOctagon className="w-3 h-3" /> Límite de tareas superado
        </div>
      )}

      {isBurnout && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-red-500 text-red-500 font-black text-5xl px-6 py-2 rounded-2xl opacity-10 pointer-events-none z-0 tracking-widest">
          BURNOUT
        </div>
      )}

      <div className={clsx('flex items-start gap-4 mb-5 relative z-10 transition-transform duration-300', isOverloaded && !isBurnout && 'mt-3')}>
        <div className="shrink-0 bg-slate-50 p-1.5 rounded-2xl shadow-sm border border-slate-100">
          <FaceAvatar mood={mood} colorClass={avatarColor} id={person.id} />
        </div>
        <div className="pt-1">
          <h3 className={clsx('font-black text-xl tracking-tight leading-none mb-1.5 transition-colors duration-300', isBurnout ? 'text-red-700' : 'text-slate-900')}>
            {person.name}
          </h3>
          <p className="text-xs text-slate-500 font-semibold mb-2">{person.role}</p>
          <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 shadow-sm">{person.description}</p>
        </div>
      </div>

      <div className="mb-6 space-y-3 bg-slate-50/80 p-4 rounded-2xl relative z-10 border border-slate-100">
        <MiniBar icon={Brain} value={state.fatigue_cognitive} />
        <MiniBar icon={Heart} value={state.fatigue_emotional} />
        <MiniBar icon={Zap} value={state.fatigue_time} />
      </div>

      <div className="flex-1 bg-slate-50/50 rounded-2xl p-3 min-h-[150px] flex flex-col gap-2.5 border-2 border-slate-100 border-dashed relative z-10">
        <div className="flex justify-between items-center mb-1 px-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tareas asignadas</span>
          <span
            className={clsx(
              'text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm transition-colors duration-300',
              isOverloaded || isBurnout ? 'bg-red-500 text-white' : 'bg-white text-slate-700 border border-slate-200'
            )}
          >
            {state.assignedTasks.length} {person.hard_constraints?.max_active_tasks ? `/ ${person.hard_constraints.max_active_tasks}` : ''}
          </span>
        </div>

        {state.assignedTasks.map((task) => (
          <AssignedTaskItem key={task.id} task={task} />
        ))}

        {state.assignedTasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">Suelta tareas aquí</div>
        )}
      </div>
    </div>
  );
}
