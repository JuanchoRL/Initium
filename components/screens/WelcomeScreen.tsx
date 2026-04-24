import React from 'react';
import { Fingerprint, CheckCircle2, BatteryWarning, Play } from 'lucide-react';
import { Button, Card } from '../ui/core';
import { GAME_DEFS } from '@/lib/constants';
import type { CandidateProfile } from '@/lib/types';

export const WelcomeScreen = ({
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

        <Card className="text-left p-5 space-y-3">
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
