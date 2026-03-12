import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { clsx } from 'clsx';
import type { Task } from './types';

interface TaskCardProps {
  task: Task;
}

const UrgencyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

const AmbiguityIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 18h8a4 4 0 0 0 0-8h-.5a7 7 0 0 0-13.3 2.5A4.5 4.5 0 0 0 8 18Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 14v-1" />
    <path d="M12 10.5c0-1 1.5-1.5 1.5-2.5a1.5 1.5 0 1 0-3 0" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const RiskIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="13" r="7" fill="currentColor" fillOpacity="0.2" />
    <path d="M16 8l1.5-1.5" />
    <path d="M18.5 5.5c.5.5 1.5.5 2 0" />
    <path d="M19 3v1" />
    <path d="M22 6h-1" />
  </svg>
);

function TaskCardBody({ task }: { task: Task }) {
  return (
    <>
      <h4 className="font-bold text-slate-800 leading-tight mb-2">{task.title}</h4>
      <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">{task.description}</p>

      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
        {task.urgency >= 4 && (
          <span className="flex items-center text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-xl shadow-sm">
            <UrgencyIcon className="w-3.5 h-3.5 mr-1.5" /> Urgente
          </span>
        )}
        {task.ambiguity >= 4 && (
          <span className="flex items-center text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-xl shadow-sm">
            <AmbiguityIcon className="w-3.5 h-3.5 mr-1.5" /> Complejo
          </span>
        )}
        {task.risk_if_wrong >= 4 && (
          <span className="flex items-center text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl shadow-sm">
            <RiskIcon className="w-3.5 h-3.5 mr-1.5" /> Riesgo
          </span>
        )}
      </div>
    </>
  );
}

export function TaskCard({ task }: TaskCardProps) {
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
      {...listeners}
      {...attributes}
      className={clsx(
        'bg-white p-4 rounded-2xl shadow-sm border-2 border-slate-100 cursor-grab active:cursor-grabbing touch-none hover:border-cyan-200 transition-colors hover:shadow-md',
        isDragging && 'opacity-90 shadow-2xl ring-4 ring-cyan-500/30 border-cyan-500 z-50 relative scale-105 rotate-2'
      )}
    >
      <TaskCardBody task={task} />
    </div>
  );
}

export function TaskCardPreview({ task }: { task: Task }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-2xl border-2 border-cyan-400 w-80 rotate-2 scale-105">
      <TaskCardBody task={task} />
    </div>
  );
}
