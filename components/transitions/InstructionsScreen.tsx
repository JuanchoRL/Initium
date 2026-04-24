import React from 'react';
import { Info, Play, MousePointerClick } from 'lucide-react';
import { Button, Card } from '../ui/core';
import { GAME_DEFS } from '@/lib/constants';
import type { GameId } from '@/lib/types';

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
  ethics: 'Investiga archivos, responde a Carlos y decide ambos casos antes de que venza el reloj.',
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
  ethics: [
    'Entrarás a un escritorio simulado con correo, archivos, chat y una app de auditoría.',
    'Lee con atención lo que aparece en pantalla y reúne contexto antes de decidir.',
    'La simulación registra cómo respondes cuando aparecen señales contradictorias y presión de tiempo.',
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

export const InstructionsScreen = ({
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
                {info.id === 'ethics' ? 'Contexto de la simulación' : 'Cómo se juega (paso a paso)'}
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
