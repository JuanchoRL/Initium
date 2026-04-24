import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { Card, Button } from '@/components/ui/core';
import { clamp } from '@/lib/math';
import type { GameResult } from '@/lib/types';
import { useTutorial } from '@/lib/hooks/useTutorial';
import { TutorialOverlay } from '@/components/ui/TutorialOverlay';

type GameProps = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
};

type CrisisEval = {
  score: number;
  feedback: string;
  suggestion: string;
  dimensions: {
    empathy: number;
    structure: number;
    decisiveness: number;
  };
  evidence: string[];
  confidence: number;
};

const CRISIS_STOP_WORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'a', 'en', 'con', 'sin', 'por', 'para', 'del', 'al', 'que', 'como', 'más', 'menos', 'muy', 'se', 'hay', 'esta', 'este', 'estas', 'estos',
]);

const normalizeCrisisText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeCrisisText = (value: string) => normalizeCrisisText(value).split(' ').filter((token) => token.length >= 3);

const extractScenarioTokens = (scenario: string) =>
  tokenizeCrisisText(scenario)
    .filter((token) => token.length >= 4 && !CRISIS_STOP_WORDS.has(token))
    .slice(0, 16);

const fallbackCrisisEval = (answer: string, scenario: string): CrisisEval => {
  const normalized = normalizeCrisisText(answer);
  const words = tokenizeCrisisText(answer);
  const answerSet = new Set(words);
  const uniqueWords = answerSet.size;
  const scenarioTokens = extractScenarioTokens(scenario);
  const overlapCount = scenarioTokens.reduce((total, token) => total + (answerSet.has(token) ? 1 : 0), 0);
  const uniqueRatio = words.length ? uniqueWords / words.length : 0;
  const longestToken = words.reduce((longest, token) => (token.length > longest.length ? token : longest), '');
  const vowelRatio = longestToken.length
    ? (longestToken.match(/[aeiouáéíóúü]/g)?.length ?? 0) / longestToken.length
    : 1;
  const gibberishLike =
    /[bcdfghjklmnñpqrstvwxyz]{6,}/i.test(answer) ||
    (longestToken.length >= 8 && vowelRatio < 0.2) ||
    (words.length >= 6 && uniqueRatio < 0.34);

  const empathySignals = ['entiendo', 'lament', 'impacto', 'cliente', 'usuarios', 'equipo', 'disculp', 'afectad'];
  const actionSignals = ['primero', 'segundo', 'luego', 'hoy', 'inmediato', 'acción', 'plan', 'mitigar', 'activo', 'coordino', 'asigno', 'resuelvo', 'informo'];
  const ownershipSignals = ['yo', 'nosotros', 'coordino', 'asigno', 'responsable', 'me hago cargo', 'resuelvo', 'priorizo'];
  const orderSignals = ['primero', 'segundo', 'tercero', 'después', 'luego', 'en paralelo', 'mientras', 'al mismo tiempo'];

  if (answer.trim().length < 8 || words.length < 3 || gibberishLike) {
    return {
      score: 0,
      feedback: gibberishLike
        ? 'La respuesta no es interpretable y no permite evaluar criterio en crisis.'
        : 'La respuesta es demasiado corta para evaluar criterio en crisis.',
      suggestion: 'Incluye al menos 3 acciones concretas: contención, comunicación y seguimiento.',
      dimensions: {
        empathy: 0,
        structure: 0,
        decisiveness: 0,
      },
      evidence: [
        gibberishLike
          ? 'No se pudo extraer una secuencia de acciones ni conexión con el escenario.'
          : 'Respuesta insuficiente para extraer evidencia conductual.',
      ],
      confidence: 0.92,
    };
  }

  const shortAnswer = answer.trim().length < 55 || words.length < 12;
  const repetitiveAnswer = uniqueWords <= Math.max(4, Math.floor(words.length * 0.45));
  const empathyHits = empathySignals.filter((token) => normalized.includes(token)).length;
  const actionHits = actionSignals.filter((token) => normalized.includes(token)).length;
  const ownershipHits = ownershipSignals.filter((token) => normalized.includes(token)).length;
  const orderHits = orderSignals.filter((token) => normalized.includes(token)).length;
  const hasActionSignal = actionHits > 0;
  const hasEmpathySignal = empathyHits > 0;
  const hasOrderSignal = orderHits > 0;

  let empathy = Math.round(
    clamp(
      18 + empathyHits * 14 + Math.min(answer.length / 20, 12),
      0,
      100
    )
  );
  let structure = Math.round(
    clamp(15 + actionHits * 13 + overlapCount * 10, 0, 100)
  );
  let decisiveness = Math.round(
    clamp(14 + ownershipHits * 16 + actionHits * 8, 0, 100)
  );

  if (overlapCount === 0) {
    structure = Math.min(structure, 32);
    decisiveness = Math.min(decisiveness, 34);
  } else if (overlapCount === 1) {
    structure = Math.min(structure, 46);
  }
  if (!hasActionSignal) decisiveness = Math.min(decisiveness, 42);
  if (!hasEmpathySignal) empathy = Math.min(empathy, 42);
  if (!hasOrderSignal) structure = Math.min(structure, 40);

  let score = Math.round(empathy * 0.36 + structure * 0.34 + decisiveness * 0.3);
  if (shortAnswer) score = Math.min(score, 38);
  if (repetitiveAnswer) score = Math.max(0, score - 18);
  if (overlapCount === 0) score = Math.min(score, 8);
  else if (overlapCount === 1) score = Math.min(score, 18);
  if (!hasActionSignal) score = Math.min(score, 20);
  if (!hasOrderSignal) score = Math.min(score, 24);
  if (!hasActionSignal && !hasEmpathySignal) score = Math.min(score, 10);
  if (!hasActionSignal && !hasOrderSignal && overlapCount <= 1) score = Math.min(score, 6);

  const evidence: string[] = [];
  if (overlapCount >= 2) evidence.push('La respuesta se relaciona con el escenario planteado.');
  else evidence.push('La respuesta no conecta con el contexto del incidente.');
  if (empathy >= 55) evidence.push('Reconoce impacto sobre cliente/equipo.');
  if (structure >= 55) evidence.push('Define secuencia de acción con prioridades.');
  if (decisiveness >= 55) evidence.push('Asume ownership y ejecución.');
  if (!hasActionSignal) evidence.push('Falta una acción operativa inmediata.');
  if (!hasOrderSignal) evidence.push('No se explicita un orden de respuesta.');
  if (repetitiveAnswer) evidence.push('Hay baja variedad de ideas en la respuesta.');

  return {
    score: clamp(score, 0, 100),
    feedback:
      overlapCount === 0
        ? 'La respuesta no está conectada con el escenario. Falta contexto para evaluar criterio real.'
        : shortAnswer
          ? 'La respuesta tiene buena intención, pero es corta para validar manejo real de crisis.'
          : 'Respuesta evaluada con rúbrica local de empatía, estructura, ejecución y coherencia contextual.',
    suggestion:
      'Estructura en 3 bloques: 1) contención inmediata, 2) comunicación a stakeholders, 3) plan con tiempos y responsables.',
    dimensions: {
      empathy,
      structure,
      decisiveness,
    },
    evidence: evidence.slice(0, 4),
    confidence: 0.78,
  };
};

export const GameProblemSolving = ({
  onComplete,
  track,
  candidateRole,
}: GameProps & { candidateRole: string }) => {
  const [scenario, setScenario] = useState('');
  const [loadingScenario, setLoadingScenario] = useState(true);
  const [answer, setAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<CrisisEval | null>(null);
  const [inputHint, setInputHint] = useState('');

  const firstTypedAt = useRef<number | null>(null);

  const tutorial = useTutorial([
    {
      id: 'step-problem-scenario',
      targetId: 'problem-solving-scenario',
      title: 'Mensaje de Equipo',
      description: 'Esta es una situación de crisis emergente reportada internamente. Haz clic para continuar.',
      actionRequired: 'custom',
      animationType: 'click',
    },
    {
      id: 'step-problem-solving-type',
      targetId: 'problem-solving-textarea',
      title: 'Tu Respuesta',
      description: 'Escribe aquí tu plan: qué dices, qué haces y en qué orden.',
      actionRequired: 'custom',
      animationType: 'click',
    }
  ], true);

  const answerStats = useMemo(() => {
    const normalized = normalizeCrisisText(answer);
    const words = tokenizeCrisisText(answer);
    const answerSet = new Set(words);
    const overlapCount = extractScenarioTokens(scenario).reduce((total, token) => total + (answerSet.has(token) ? 1 : 0), 0);
    const longestToken = words.reduce((longest, token) => (token.length > longest.length ? token : longest), '');
    const uniqueRatio = words.length ? answerSet.size / words.length : 0;
    const vowelRatio = longestToken.length
      ? (longestToken.match(/[aeiouáéíóúü]/g)?.length ?? 0) / longestToken.length
      : 1;
    const actionSignal = ['primero', 'plan', 'acción', 'hoy', 'mitigar', 'comunico'].some((token) =>
      normalized.includes(token)
    );
    const orderSignal = ['primero', 'segundo', 'tercero', 'después', 'luego', 'en paralelo', 'mientras'].some(
      (token) => normalized.includes(token)
    );
    const empathySignal = ['cliente', 'equipo', 'impacto', 'disculp', 'entiendo'].some((token) =>
      normalized.includes(token)
    );
    const gibberishLike =
      /[bcdfghjklmnñpqrstvwxyz]{6,}/i.test(answer) ||
      (longestToken.length >= 8 && vowelRatio < 0.2) ||
      (words.length >= 6 && uniqueRatio < 0.34);

    return {
      charCount: answer.trim().length,
      wordCount: words.length,
      overlapCount,
      uniqueRatio,
      hasActionSignal: actionSignal,
      hasOrderSignal: orderSignal,
      hasEmpathySignal: empathySignal,
      hasScenarioSignal: overlapCount >= 2,
      gibberishLike,
    };
  }, [answer, scenario]);

  const loadScenario = useCallback(async () => {
    setLoadingScenario(true);
    try {
      const response = await fetch(`/api/evaluate-crisis?task=scenario&nonce=${Date.now()}`, { cache: 'no-store' });
      const data = (await response.json()) as { scenario?: string };
      setScenario(
        data.scenario ||
          'El sistema de pagos cae durante una campaña alta y clientes reportan cobros duplicados en redes.'
      );
    } catch {
      setScenario('El sistema de pagos cae durante una campaña alta y clientes reportan cobros duplicados en redes.');
    } finally {
      setLoadingScenario(false);
    }
  }, []);

  useEffect(() => {
    void loadScenario();
  }, [loadScenario]);

  const minimumChars = 55;
  const minimumWords = 10;
  const canSubmit =
    !isEvaluating &&
    !loadingScenario &&
    answerStats.charCount >= minimumChars &&
    answerStats.wordCount >= minimumWords &&
    !answerStats.gibberishLike;

  const normalizeEval = (evalData: CrisisEval): CrisisEval => ({
    ...evalData,
    score: Math.round(evalData.score),
    dimensions: {
      empathy: Math.round(evalData.dimensions.empathy),
      structure: Math.round(evalData.dimensions.structure),
      decisiveness: Math.round(evalData.dimensions.decisiveness),
    },
    confidence: Number(evalData.confidence.toFixed(2)),
  });

  const submit = async () => {
    if (!answer.trim() || isEvaluating || loadingScenario) return;
    if (answerStats.charCount < minimumChars) {
      setInputHint(`Necesitas al menos ${minimumChars} caracteres con acciones concretas.`);
      return;
    }
    if (answerStats.wordCount < minimumWords) {
      setInputHint(`Necesitas al menos ${minimumWords} palabras para describir tu plan.`);
      return;
    }
    if (answerStats.gibberishLike) {
      setResult(
        normalizeEval({
          score: 0,
          feedback: 'La respuesta no es interpretable y no permite evaluar criterio en crisis.',
          suggestion: 'Describe en lenguaje simple qué harías primero, cómo comunicarías y qué seguimiento harías.',
          dimensions: {
            empathy: 0,
            structure: 0,
            decisiveness: 0,
          },
          evidence: ['No se identificó una secuencia comprensible de acciones.'],
          confidence: 0.96,
        })
      );
      setInputHint('');
      return;
    }

    const writingTimeMs = firstTypedAt.current ? Date.now() - firstTypedAt.current : 0;
    setIsEvaluating(true);
    setInputHint('');

    track('decision_made', {
      answerChars: answer.trim().length,
      answerWords: answerStats.wordCount,
      hasActionSignal: answerStats.hasActionSignal,
      hasEmpathySignal: answerStats.hasEmpathySignal,
      hasScenarioSignal: answerStats.hasScenarioSignal,
      writingTimeMs,
    });

    try {
      const response = await fetch('/api/evaluate-crisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'evaluate',
          scenario,
          answer,
          role: candidateRole,
          writingTimeMs,
        }),
      });

      if (!response.ok) throw new Error('evaluation_error');
      const data = normalizeEval((await response.json()) as CrisisEval);
      if (answerStats.charCount < 65 && data.score > 48) {
        setResult({
          ...data,
          score: 48,
          feedback: 'La respuesta fue breve; se ajustó el puntaje por baja evidencia conductual.',
        });
      } else if (answerStats.overlapCount <= 1 && data.score > 24) {
        setResult({
          ...data,
          score: 24,
          feedback: 'La respuesta no conecta suficientemente con el escenario; el puntaje se ajustó por baja coherencia contextual.',
        });
      } else if ((!answerStats.hasActionSignal || !answerStats.hasOrderSignal) && data.score > 38) {
        setResult({
          ...data,
          score: 38,
          feedback: 'La respuesta no describe un plan operativo claro; el puntaje se ajustó por baja ejecutabilidad.',
        });
      } else {
        setResult(data);
      }
    } catch {
      setResult(normalizeEval(fallbackCrisisEval(answer, scenario)));
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in pt-8 px-4 relative z-0">
      <TutorialOverlay
        isActive={tutorial.isActive}
        targetRect={tutorial.targetRect}
        step={tutorial.currentStep}
      />
      <Card 
        id="problem-solving-scenario"
        className={`border-l-4 border-l-cyan-500 bg-stone-50 relative z-10 transition-colors ${tutorial.isActive && tutorial.currentStep?.id === 'step-problem-scenario' ? 'cursor-pointer hover:bg-stone-100' : ''}`}
        onClickCapture={() => {
          if (tutorial.isActive && tutorial.currentStep?.id === 'step-problem-scenario') {
            tutorial.advanceStep();
          }
        }}
      >
        <h3 className="text-sm font-bold text-cyan-700 mb-2 uppercase tracking-wide flex items-center gap-2">Escenario entrante</h3>
        {loadingScenario ? (
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        ) : (
          <p className="text-xl text-stone-800 font-serif italic leading-relaxed">"{scenario}"</p>
        )}
      </Card>

      {!result ? (
        <div className="space-y-4">
          <textarea
            id="problem-solving-textarea"
            value={answer}
            onChange={(event) => {
              if (tutorial.isActive) tutorial.advanceStep();
              if (!firstTypedAt.current) firstTypedAt.current = Date.now();
              setAnswer(event.target.value);
            }}
            placeholder="Escribe tu respuesta inmediata: qué dices, qué haces y en qué orden."
            className="w-full h-44 bg-white border border-stone-300 rounded-xl p-4 text-stone-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all outline-none resize-none shadow-sm text-base"
            disabled={isEvaluating}
          />
          <div className="flex justify-between items-center text-xs text-stone-400">
            <span>Usa enfoque: impacto, acción inmediata, comunicación y seguimiento.</span>
            <span>
              {answerStats.charCount} caracteres | {answerStats.wordCount} palabras
            </span>
          </div>
          <div className="grid md:grid-cols-4 gap-2 text-xs">
            <div className={`rounded border px-2 py-1 ${answerStats.charCount >= minimumChars ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Mínimo {minimumChars} caracteres
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.wordCount >= minimumWords ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Al menos {minimumWords} palabras
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.hasActionSignal ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Incluye acción operativa
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.hasOrderSignal ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Ordena la respuesta
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.hasEmpathySignal ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Reconoce impacto humano
            </div>
            <div className={`rounded border px-2 py-1 ${answerStats.hasScenarioSignal ? 'border-green-200 bg-green-50 text-green-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
              Responde al escenario
            </div>
            <div className={`rounded border px-2 py-1 ${!answerStats.gibberishLike ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              Texto interpretable
            </div>
          </div>
          {inputHint ? <p className="text-xs text-red-500">{inputHint}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} variant="ai" disabled={!canSubmit}>
              {isEvaluating ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2" /> Evaluando
                </>
              ) : (
                'Enviar respuesta'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Card className="animate-fade-in border-t-4 border-t-cyan-500">
          <div className="text-center mb-6">
            <div className={`text-6xl font-bold mb-2 ${result.score >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>{result.score}</div>
            <div className="text-stone-400 text-xs uppercase font-bold tracking-widest">Puntaje de eficacia</div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mb-4">
            {(
              [
                ['Empatía', result.dimensions.empathy],
                ['Estructura', result.dimensions.structure],
                ['Decisión', result.dimensions.decisiveness],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="p-3 rounded-lg border border-stone-200 bg-white">
                <div className="text-[11px] uppercase tracking-wide text-stone-400 font-bold">{label}</div>
                <div className="text-2xl font-bold text-cyan-700">{value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
              <h4 className="font-bold text-stone-700 mb-1">Feedback</h4>
              <p className="text-stone-600">{result.feedback}</p>
            </div>
            <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-100">
              <h4 className="font-bold text-cyan-700 mb-1">Mejor enfoque sugerido</h4>
              <p className="text-cyan-800 italic">"{result.suggestion}"</p>
            </div>
            {result.evidence?.length ? (
              <div className="bg-stone-50 p-4 rounded-lg border border-stone-200">
                <h4 className="font-bold text-stone-700 mb-2">Evidencia detectada</h4>
                <ul className="space-y-1 text-sm text-stone-600">
                  {result.evidence.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="text-[11px] text-stone-400 uppercase tracking-wide">Confianza del análisis: {Math.round(result.confidence * 100)}%</div>
          </div>

          <Button
            onClick={() => {
              const writingTimeMs = firstTypedAt.current ? Date.now() - firstTypedAt.current : 0;
              onComplete({
                score: result.score,
                metrics: {
                  answer_chars: answerStats.charCount,
                  answer_words: answerStats.wordCount,
                  writing_time_ms: writingTimeMs,
                  empathy: result.dimensions.empathy,
                  structure: result.dimensions.structure,
                  decisiveness: result.dimensions.decisiveness,
                  confidence: result.confidence,
                },
              });
            }}
            className="w-full mt-6 flex justify-center items-center gap-2"
          >
            Siguiente fase <ChevronRight className="w-4 h-4" />
          </Button>
        </Card>
      )}
    </div>
  );
};
