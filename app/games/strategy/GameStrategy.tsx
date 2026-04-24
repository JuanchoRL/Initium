import React, { useState } from 'react';
import { Card, Button } from '@/components/ui/core';
import { clamp, stdDev, entropy } from '@/lib/math';
import type { GameResult } from '@/lib/types';
import { useTutorial } from '@/lib/hooks/useTutorial';
import { TutorialOverlay } from '@/components/ui/TutorialOverlay';

type GameProps = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
  setStrategyProfile: (profile: string) => void;
};

type AllocationKey = 'ops' | 'staff' | 'data' | 'rd';
type AllocationMap = Record<AllocationKey, number>;

export const GameStrategy = ({
  onComplete,
  track,
  setStrategyProfile,
}: GameProps) => {
  const [allocations, setAllocations] = useState<AllocationMap>({
    ops: 0,
    staff: 0,
    data: 0,
    rd: 0,
  });
  const [adjustments, setAdjustments] = useState(0);

  const tutorial = useTutorial([
    {
      id: 'step-strategy-case',
      targetId: 'strategy-business-case',
      title: 'Contexto Estratégico',
      description: 'Lee detenidamente el caso de negocio. De tu análisis dependerá en donde inviertes más o menos riesgo.',
      actionRequired: 'custom',
      animationType: 'click',
    },
    {
      id: 'step-strategy-matrix',
      targetId: 'strategy-matrix-header',
      title: 'Presupuesto Total',
      description: 'Cuentas con un 100% disponible de capital. Debes repartirlo íntegramente entre las cuatro áreas para confirmar tu decisión.',
      actionRequired: 'custom',
      animationType: 'click',
    },
    {
      id: 'step-strategy-slide',
      targetId: 'strategy-slider-ops',
      title: 'Matriz Estratégica',
      description: 'Asigna el porcentaje de capital deseado deslizando esta barra.',
      actionRequired: 'custom',
      animationType: 'drag',
    }
  ], true);

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
    if (tutorial.isActive && id === 'ops') {
      tutorial.advanceStep();
    }

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
    <div className="w-full max-w-3xl mx-auto space-y-8 animate-fade-in pt-8 px-4 relative z-0">
      <TutorialOverlay
        isActive={tutorial.isActive}
        targetRect={tutorial.targetRect}
        step={tutorial.currentStep}
      />
      <Card 
        id="strategy-business-case" 
        className={`border-t-4 border-t-cyan-500 ${tutorial.isActive && tutorial.currentStep?.id === 'step-strategy-case' ? 'cursor-pointer' : ''}`}
        onClickCapture={() => {
          if (tutorial.isActive && tutorial.currentStep?.id === 'step-strategy-case') tutorial.advanceStep();
        }}
      >
        <h3 className="text-xl font-bold text-stone-800 mb-2">Caso de negocio: Expansion Series B</h3>
        <p className="text-stone-600 leading-relaxed text-sm">
          Cerraste una ronda clave y debes distribuir el 100% del capital para 12 meses. Tu decisión define velocidad, seguridad,
          cultura e innovacion. No hay respuesta unica, pero si trade-offs visibles.
        </p>
      </Card>

      <div 
        id="strategy-matrix-header" 
        className={`text-center ${tutorial.isActive && tutorial.currentStep?.id === 'step-strategy-matrix' ? 'cursor-pointer' : ''}`}
        onClickCapture={() => {
          if (tutorial.isActive && tutorial.currentStep?.id === 'step-strategy-matrix') tutorial.advanceStep();
        }}
      >
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
                id={`strategy-slider-${category.id}`}
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
