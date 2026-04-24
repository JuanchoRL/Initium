import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import type { RoundResult } from './types';

interface Props {
  result: RoundResult;
  round: number;
  isFinalRound: boolean;
  onNextRound: () => void;
}

export function ResultsModal({ result, round, isFinalRound, onNextRound }: Props) {
  const scoreTone =
    result.totalScore >= 75
      ? 'text-emerald-600'
      : result.totalScore >= 55
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl p-6 md:p-8 animate-fade-in">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-cyan-700 font-bold">Resumen de ronda</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">Ronda {round} completada</h3>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">Puntaje</p>
            <p className={`text-4xl font-black ${scoreTone}`}>{result.totalScore}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Fit
            </div>
            <div className="text-xl font-bold text-slate-900">{result.fitScore}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Cobertura
            </div>
            <div className="text-xl font-bold text-slate-900">{result.complianceScore}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Balance
            </div>
            <div className="text-xl font-bold text-slate-900">{result.balanceScore}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Riesgo
            </div>
            <div className="text-xl font-bold text-slate-900">{result.riskScore}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 mb-6">
          {result.insights.slice(0, 4).map((insight) => (
            <p key={insight} className="text-sm text-slate-700">
              - {insight}
            </p>
          ))}
          {result.burnouts.length > 0 && (
            <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Riesgo de burnout: {result.burnouts.join(', ')}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onNextRound}
            className="px-8 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold transition-all hover:scale-105 active:scale-95"
          >
            {isFinalRound ? 'Finalizar evaluación' : 'Siguiente ronda'}
          </button>
        </div>
      </div>
    </div>
  );
}
