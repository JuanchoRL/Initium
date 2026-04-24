import React, { useState } from 'react';
import { ChevronRight, Lock, ShieldAlert, Compass, CheckCircle2, Database } from 'lucide-react';
import { Button, Card, ToggleRow } from '../ui/core';
import type { CandidateProfile } from '@/lib/types';

export const ConsentScreen = ({
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
    <div data-testid="consent-screen" className="min-h-screen flex items-center justify-center p-4 animate-fade-in relative overflow-hidden bg-stone-50">
      <div className="absolute inset-0 bg-gradient-to-br from-stone-100 to-stone-200/50 z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-200/30 via-transparent to-transparent z-0" />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay z-0 pointer-events-none" />

      <div className="max-w-2xl w-full space-y-6 relative z-10 flex flex-col items-center">
        <div className="bg-white/40 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[2rem] w-full p-6 md:p-8 overflow-hidden group">
          <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-cyan-400/10 to-sky-300/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000"></div>
          
          <div className="relative z-10">
            <h2 className="text-[1.8rem] font-black text-transparent bg-clip-text bg-gradient-to-br from-stone-800 to-stone-600 tracking-[-0.01em] mb-3">Consentimiento informado</h2>
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
            <Button variant="secondary" onClick={onBack} className="bg-white hover:bg-stone-50 border-stone-200">
              Volver
            </Button>
            <Button
              className="bg-cyan-600 hover:bg-cyan-700 shadow-md shadow-cyan-600/20"
              onClick={() =>
                onConfirm({
                  ...candidate,
                  acceptedTerms,
                  acceptedDataPolicy,
                })
              }
              disabled={!acceptedTerms || !acceptedDataPolicy}
            >
              Continuar <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-md rounded-2xl w-full border border-white/50 p-4 shadow-sm">
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
        </div>
      </div>
    </div>
  );
};
