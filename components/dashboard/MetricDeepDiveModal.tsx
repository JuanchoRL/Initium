import React from 'react';
import { X, Activity, BarChart3, AlertCircle, Clock, Zap } from 'lucide-react';
import { GameId, GameMetrics } from '@/lib/types';
import { AnimatedNumber } from '../ui/AnimatedNumber';

const humanizeMetricName = (key: string): string => {
  const overrides: Record<string, string> = {
    role_match_rate: 'Tasa de Acierto de Rol (%)',
    mismatch_count: 'Asignaciones Subóptimas',
    technical_mismatch_count: 'Desajustes Críticos de Exigencia',
    overload_warnings: 'Alertas de Sobrecarga',
    correct_patterns: 'Patrones Visuales Correctos',
    total_rounds: 'Rondas Totales Jugadas',
    avg_reconstruction_time_sec: 'Tiempo Promedio de Reconstrucción (s)',
    empathy: 'Empatía en Crisis (Score)',
    structure: 'Estructura Resolutiva (Score)',
    decisiveness: 'Nivel de Decisión (Score)',
    word_count: 'Palabras Redactadas',
    ethical_integrity: 'Integridad Ética',
    human_empathy: 'Empatía Humana vs Regla',
    authority_alignment: 'Alineación a la Autoridad',
    decision_consistency: 'Consistencia Moral Corto/Largo plazo',
    pressure_control: 'Estabilidad bajo Presión Grupal',
    explosions: 'Sobrecargas al Límite (Explosiones)',
    avg_sell_ms: 'Tiempo Promedio de Reacción (ms)',
    max_multiplier: 'Multiplicador Máximo Sostenido',
    switch_flips: 'Cambios de Enfoque Activos',
    critical_failures: 'Fallas por Desatención Múltiple',
    ops: 'Preferencia en Operaciones y Ejecución',
    staff: 'Preferencia en Equipo y Roles',
    data: 'Preferencia en Control y Riesgo',
    rd: 'Preferencia en Innovación',
  };
  return overrides[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getMetricIcon = (key: string) => {
  if (key.includes('time') || key.includes('ms')) return <Clock className="w-4 h-4 text-cyan-500" />;
  if (key.includes('warning') || key.includes('mismatch') || key.includes('explosions') || key.includes('failure')) return <AlertCircle className="w-4 h-4 text-amber-500" />;
  if (key.includes('score') || key.includes('rate') || key.includes('pct') || key.includes('integrity') || key.includes('empathy') || key.includes('ops')) return <Activity className="w-4 h-4 text-emerald-500" />;
  return <Zap className="w-4 h-4 text-indigo-400" />;
};

export const MetricDeepDiveModal = ({
  gameId,
  score,
  metrics,
  onClose,
}: {
  gameId: GameId;
  score: number;
  metrics: GameMetrics;
  onClose: () => void;
}) => {
  const gameTitles: Record<GameId, string> = {
    personality: 'Test de Arquetipo',
    memory: 'Evaluación de Memoria',
    leadership: 'Simulación de Gestión',
    problemSolving: 'Respuesta ante Crisis',
    ethics: 'Auditoría Ética',
    risk: 'Gestión de Riesgos',
    network: 'Control de Multitarea',
    strategy: 'Priorización Estratégica',
  };

  const skipKeys = ['ending_id', 'promise_choice', 'case1_decision', 'case2_decision', 'q1_choice', 'q2_choice', 'q3_choice', 'q4_choice', 'q5_choice', 'q6_choice', 'q7_choice', 'q1_signal', 'q2_signal', 'q3_signal', 'q4_signal', 'q5_signal', 'q6_signal', 'q7_signal'];

  const displayMetrics = Object.entries(metrics)
    .filter(([key]) => !skipKeys.includes(key) && !key.includes('disc_'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl w-full max-w-lg shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden border border-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div>
            <div className="flex items-center gap-2 text-stone-500 text-xs font-bold uppercase tracking-wider mb-1">
              <BarChart3 className="w-3.5 h-3.5" /> Detalle de Telemetría
            </div>
            <h3 className="text-xl font-bold text-stone-800 tracking-tight">{gameTitles[gameId]}</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-end gap-3 mb-6 bg-cyan-50 border border-cyan-100 rounded-xl p-4">
            <div className="text-xs font-bold text-cyan-800 uppercase tracking-widest leading-none mb-1">Score Ponderado</div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-cyan-600 leading-none">
                <AnimatedNumber value={score} duration={800} />
              </span>
              <span className="text-sm font-bold text-cyan-700/60">/ 100</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-3 ml-1">Métricas de Comportamiento Bruto</h4>
            {displayMetrics.length > 0 ? (
              <ul className="space-y-2">
                {displayMetrics.map(([key, value]) => {
                  const numberVal = typeof value === 'number' ? value : parseFloat(String(value));
                  const isNumber = !isNaN(numberVal);
                  return (
                    <li key={key} className="flex justify-between items-center p-3 rounded-lg border border-stone-100 bg-white hover:bg-stone-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {getMetricIcon(key)}
                        <span className="text-sm font-medium text-stone-700">{humanizeMetricName(key)}</span>
                      </div>
                      <span className="font-bold text-stone-800 tabular-nums">
                        {isNumber && numberVal < 200 ? <AnimatedNumber value={numberVal} duration={900} /> : String(value)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
               <p className="text-sm text-stone-500 italic px-2">No hay métricas granulares disponibles para esta evaluación.</p>
            )}
          </div>
        </div>

        <div className="bg-stone-50 px-6 py-4 border-t border-stone-100 text-right">
          <button 
            type="button"
            className="text-sm font-bold text-stone-600 bg-white border border-stone-200 px-4 py-2 rounded-lg hover:bg-stone-100 transition-colors shadow-sm"
            onClick={onClose}
          >
            Cerrar detalle
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in > div {
          animation: fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};
