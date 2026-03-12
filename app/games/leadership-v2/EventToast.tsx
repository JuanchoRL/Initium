import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { GameEvent } from './types';

interface Props {
  event: GameEvent | null;
  onClose: () => void;
}

export function EventToast({ event, onClose }: Props) {
  if (!event) return null;

  return (
    <div className="fixed top-24 right-4 z-40 max-w-sm w-[calc(100vw-2rem)] animate-fade-in">
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 shadow-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-cyan-700 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide font-bold text-cyan-700">Evento de ronda</p>
              <h4 className="text-sm font-bold text-cyan-900 leading-tight mt-0.5">{event.title}</h4>
              <p className="text-xs text-cyan-800 mt-1 leading-relaxed">{event.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-cyan-700 hover:bg-cyan-100 transition-colors"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
