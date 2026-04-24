import React from 'react';
import { Save } from 'lucide-react';
import { Button } from './core';
import { GAME_DEFS } from '@/lib/constants';

export const ProgressBar = ({
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
