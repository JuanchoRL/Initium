import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EvaluateTaskBody = {
  task: 'evaluate';
  scenario: string;
  answer: string;
  role?: string;
  writingTimeMs?: number;
};

type SummaryTaskBody = {
  task: 'summary';
  role?: string;
  scores?: Record<string, number>;
  metrics?: Record<string, Record<string, number | string | boolean>>;
  strategyProfile?: string;
  personalityProfile?: string;
};

const scenarios = [
  'Un proveedor crítico confirma una brecha de seguridad horas antes de una demo con cliente enterprise.',
  'Durante el lanzamiento de producto, se duplican cobros y el soporte colapsa con reclamos masivos.',
  'El CTO y la líder de ventas entran en conflicto público por prioridades opuestas en roadmap.',
  'Una migración de datos genera pérdida parcial de información y el equipo legal exige respuesta inmediata.',
  'El sistema de turnos de un hospital cae y RRHH necesita una solución temporal en menos de una hora.',
  'Un candidato viraliza en LinkedIn una experiencia negativa y el pipeline de talento cae 40% en 24 horas.',
  'La plataforma de onboarding rechaza documentos válidos y frena 120 ingresos de nuevas contrataciones.',
  'Un cliente enterprise exige RCA en 3 horas por una evaluación inconsistente entre dos candidatos similares.',
  'Una automatización de scoring deja fuera a perfiles senior y el equipo de recruiting detecta sesgo operativo.',
  'El panel de analytics muestra métricas contradictorias y hiring managers cuestionan la confiabilidad del sistema.',
  'Una integración externa cambia su API sin aviso y rompe el flujo de entrevistas técnicas en plena campaña.',
  'Soporte reporta respuestas agresivas por demoras en feedback; riesgo de daño reputacional inmediato.',
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const STOP_WORDS = new Set([
  'de',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'u',
  'a',
  'ante',
  'con',
  'sin',
  'por',
  'para',
  'en',
  'al',
  'del',
  'se',
  'que',
  'como',
  'mas',
  'menos',
  'muy',
  'ya',
  'hay',
  'esto',
  'esta',
  'este',
  'estas',
  'estos',
  'eso',
  'esos',
  'esas',
  'ser',
  'estar',
  'fue',
  'son',
  'era',
  'tambien',
  'sobre',
  'entre',
  'hacia',
  'desde',
  'cuando',
  'donde',
  'quien',
  'cual',
]);

const ACTION_TOKENS = [
  'activo',
  'coordino',
  'asigno',
  'resuelvo',
  'escalo',
  'ejecuto',
  'priorizo',
  'organizo',
  'comunico',
  'defino',
  'habilito',
  'mitigo',
  'plan',
  'accion',
  'seguimiento',
];

const ORDER_TOKENS = ['primero', 'segundo', 'tercero', 'luego', 'despues', 'mientras', 'hoy', 'inmediato', 'paralelo'];

const EMPATHY_TOKENS = [
  'cliente',
  'equipo',
  'personas',
  'usuario',
  'usuarios',
  'candidato',
  'candidatos',
  'impacto',
  'afectados',
  'confianza',
  'disculp',
  'entiendo',
  'acompan',
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) => normalizeText(value).split(' ').filter((token) => token.length >= 3);

const extractScenarioKeywords = (scenario: string) => {
  const tokens = tokenize(scenario).filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => (b[1] === a[1] ? b[0].length - a[0].length : b[1] - a[1]))
    .slice(0, 16)
    .map(([token]) => token);
};

const countTokenMatches = (normalizedText: string, tokens: string[]) =>
  tokens.reduce((total, token) => (normalizedText.includes(token) ? total + 1 : total), 0);

type QualityAnalysis = {
  qualityScore: number;
  tier: 'ok' | 'low' | 'very_low';
  overlapCount: number;
  uniqueRatio: number;
  wordCount: number;
  shortAnswer: boolean;
  repetitiveAnswer: boolean;
  gibberishLike: boolean;
  hasActionSignal: boolean;
  hasOrderSignal: boolean;
  hasEmpathySignal: boolean;
  actionHits: number;
  orderHits: number;
  empathyHits: number;
};

const analyzeResponseQuality = (answer: string, scenario: string): QualityAnalysis => {
  const normalizedAnswer = normalizeText(answer);
  const answerTokens = tokenize(answer);
  const answerSet = new Set(answerTokens);
  const uniqueRatio = answerTokens.length ? answerSet.size / answerTokens.length : 0;
  const longestToken = answerTokens.reduce((longest, token) => (token.length > longest.length ? token : longest), '');
  const vowelRatio = longestToken.length
    ? (longestToken.match(/[aeiouáéíóúü]/g)?.length ?? 0) / longestToken.length
    : 1;
  const scenarioKeywords = extractScenarioKeywords(scenario);
  const overlapCount = scenarioKeywords.reduce((total, token) => total + (answerSet.has(token) ? 1 : 0), 0);
  const actionHits = countTokenMatches(normalizedAnswer, ACTION_TOKENS);
  const orderHits = countTokenMatches(normalizedAnswer, ORDER_TOKENS);
  const empathyHits = countTokenMatches(normalizedAnswer, EMPATHY_TOKENS);
  const shortAnswer = answer.trim().length < 55 || answerTokens.length < 12;
  const repetitiveAnswer = uniqueRatio <= 0.5;
  const gibberishLike =
    /[bcdfghjklmnñpqrstvwxyz]{6,}/i.test(answer) ||
    (longestToken.length >= 8 && vowelRatio < 0.2) ||
    (answerTokens.length >= 6 && uniqueRatio < 0.34);

  let penalty = 0;
  if (shortAnswer) penalty += 24;
  if (answerTokens.length < 14) penalty += 16;
  if (overlapCount === 0) penalty += 38;
  else if (overlapCount === 1) penalty += 24;
  if (actionHits === 0) penalty += 20;
  if (orderHits === 0) penalty += 12;
  if (empathyHits === 0) penalty += 10;
  if (uniqueRatio < 0.55) penalty += 16;
  if (repetitiveAnswer) penalty += 10;
  if (gibberishLike) penalty += 42;

  const qualityScore = clamp(100 - penalty, 0, 100);
  const tier: QualityAnalysis['tier'] = qualityScore < 42 ? 'very_low' : qualityScore < 65 ? 'low' : 'ok';

  return {
    qualityScore,
    tier,
    overlapCount,
    uniqueRatio,
    wordCount: answerTokens.length,
    shortAnswer,
    repetitiveAnswer,
    gibberishLike,
    hasActionSignal: actionHits > 0,
    hasOrderSignal: orderHits > 0,
    hasEmpathySignal: empathyHits > 0,
    actionHits,
    orderHits,
    empathyHits,
  };
};

const safeParseJson = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const extractJsonBlock = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? trimmed;
};

const localEvaluate = (answer: string, scenario: string, qualityInput?: QualityAnalysis) => {
  const quality = qualityInput || analyzeResponseQuality(answer, scenario);
  const normalized = normalizeText(answer);

  if (answer.trim().length < 8 || quality.wordCount < 3 || quality.gibberishLike) {
    return {
      score: 0,
      feedback: quality.gibberishLike
        ? 'La respuesta no es interpretable y no permite evaluar criterio de crisis.'
        : 'Respuesta demasiado corta para evaluar criterio de crisis.',
      suggestion: 'Incluye acciones en 3 pasos: contención, comunicación y seguimiento.',
      dimensions: {
        empathy: 0,
        structure: 0,
        decisiveness: 0,
      },
      evidence: [
        quality.gibberishLike
          ? 'No se identificó una secuencia comprensible de acciones ni relación con el escenario.'
          : 'Sin evidencia suficiente para evaluar comportamiento.',
      ],
      confidence: 0.95,
    };
  }

  let empathy = Math.round(clamp(20 + quality.empathyHits * 16 + Math.min(answer.length / 24, 12), 0, 100));
  let structure = Math.round(clamp(18 + quality.orderHits * 17 + quality.overlapCount * 9, 0, 100));
  let decisiveness = Math.round(clamp(18 + quality.actionHits * 16 + Math.min(quality.wordCount / 3, 10), 0, 100));

  if (quality.overlapCount === 0) {
    structure = Math.min(structure, 30);
    decisiveness = Math.min(decisiveness, 34);
  } else if (quality.overlapCount === 1) {
    structure = Math.min(structure, 44);
  }

  if (!quality.hasEmpathySignal) empathy = Math.min(empathy, 40);
  if (!quality.hasActionSignal) decisiveness = Math.min(decisiveness, 40);
  if (!quality.hasOrderSignal) structure = Math.min(structure, 42);

  let score = Math.round(clamp(empathy * 0.34 + structure * 0.36 + decisiveness * 0.3, 0, 100));
  score = Math.round(score * (0.55 + quality.qualityScore / 320));
  if (quality.shortAnswer) score = Math.min(score, 38);
  if (quality.repetitiveAnswer) score = Math.max(0, score - 18);
  if (quality.tier === 'low') score = Math.min(score, 32);
  if (quality.tier === 'very_low') score = Math.min(score, 12);
  if (quality.overlapCount === 0) score = Math.min(score, 8);
  else if (quality.overlapCount === 1) score = Math.min(score, 18);
  if (!quality.hasActionSignal) score = Math.min(score, 20);
  if (!quality.hasOrderSignal) score = Math.min(score, 24);
  if (!quality.hasActionSignal && !quality.hasEmpathySignal && !quality.hasOrderSignal) score = Math.min(score, 6);

  const evidence: string[] = [];
  if (quality.overlapCount >= 2) evidence.push('La respuesta se conecta con el contexto del incidente.');
  else evidence.push('Falta relación explícita entre respuesta y escenario.');
  if (empathy >= 55) evidence.push('Reconoce impacto humano y reputacional.');
  if (structure >= 55) evidence.push('Propone una secuencia operativa entendible.');
  if (decisiveness >= 55) evidence.push('Asume ownership y coordina ejecución.');
  if (!quality.hasActionSignal) evidence.push('No aparece una acción concreta inmediata.');
  if (quality.repetitiveAnswer) evidence.push('La respuesta presenta baja variedad y poca profundidad.');

  return {
    score: clamp(score, 0, 100),
    feedback:
      quality.tier === 'very_low'
        ? 'La respuesta no está conectada con el escenario o es demasiado genérica para evaluar criterio.'
        : quality.tier === 'low'
          ? 'La respuesta muestra intención, pero falta relación clara con el contexto y un plan operativo concreto.'
          : quality.shortAnswer
            ? 'La respuesta fue breve; faltan detalles para validar ejecución real.'
            : 'Evaluación con rúbrica de empatía, estructura, decisión y coherencia contextual.',
    suggestion: 'Explicita en 3 pasos: contención inmediata, comunicación y plan de recuperación con tiempos.',
    dimensions: {
      empathy,
      structure,
      decisiveness,
    },
    evidence: evidence.slice(0, 4),
    confidence: Number((0.55 + quality.qualityScore / 220).toFixed(2)),
  };
};

const buildSummaryFallback = (payload: SummaryTaskBody) => {
  const scores = payload.scores ?? {};
  const values = Object.values(scores);
  const overall = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

  const best = Object.entries(scores).reduce<[string, number]>(
    (currentBest, entry) => (entry[1] > currentBest[1] ? [entry[0], entry[1]] : currentBest),
    ['n/a', -1]
  );

  const riskExplosions = Number(payload.metrics?.risk?.explosions ?? 0);
  const networkAccuracy = Number(payload.metrics?.network?.accuracy ?? 0);

  const fitLabel = overall >= 80 ? 'alto' : overall >= 65 ? 'medio-alto' : overall >= 50 ? 'medio' : 'en desarrollo';
  const riskLabel = riskExplosions === 0 ? 'estable' : riskExplosions <= 2 ? 'con alertas puntuales' : 'con riesgo de sobrerreacción';
  const multitaskLabel =
    networkAccuracy >= 0.75 ? 'solida' : networkAccuracy >= 0.55 ? 'aceptable' : 'a reforzar';

  return (
    `Perfil para ${payload.role || 'rol objetivo'} con ajuste ${fitLabel} (índice ${overall}/100). ` +
    `Fortaleza principal en ${best[0]} (${best[1]}), con gestión de presión ${riskLabel} y multitarea ${multitaskLabel}. ` +
    `Estrategia dominante: ${payload.strategyProfile || 'sin dominancia clara'}${payload.personalityProfile ? ` y arquetipo ${payload.personalityProfile}` : ''}. ` +
    'Recomendado: entrevista por competencias enfocada en trade-offs y priorización.'
  );
};

async function callGeminiJson(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!response.ok) return null;
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return extractJsonBlock(text);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const task = request.nextUrl.searchParams.get('task');
  if (task === 'scenario') {
    const index = Math.floor(Math.random() * scenarios.length);
    return NextResponse.json(
      { scenario: scenarios[index] },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
        },
      }
    );
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  let body: EvaluateTaskBody | SummaryTaskBody;

  try {
    body = (await request.json()) as EvaluateTaskBody | SummaryTaskBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (body.task === 'evaluate') {
    if (!body.scenario || !body.answer) {
      return NextResponse.json({ error: 'scenario and answer are required' }, { status: 400 });
    }

    const quality = analyzeResponseQuality(body.answer, body.scenario);
    const fallback = localEvaluate(body.answer, body.scenario, quality);

    if (quality.tier !== 'ok') {
      return NextResponse.json({
        ...fallback,
        feedback: `${fallback.feedback} Puntaje ajustado por baja coherencia con el escenario.`,
        confidence: clamp(Number(fallback.confidence || 0.8), 0.7, 0.95),
      });
    }

    const prompt = [
      'Actúa como evaluador de crisis para selección de talento.',
      'Evalúa solo con esta rúbrica: empatía, estructura, decisión operativa.',
      `Escenario: ${body.scenario}`,
      `Rol objetivo: ${body.role || 'n/a'}`,
      `Tiempo de escritura ms: ${body.writingTimeMs || 0}`,
      `Respuesta del candidato: ${body.answer}`,
      'Devuelve JSON válido con formato exacto:',
      '{"score":number,"feedback":"string","suggestion":"string","dimensions":{"empathy":number,"structure":number,"decisiveness":number},"evidence":["string"],"confidence":number}',
    ].join('\n');

    const geminiRaw = await callGeminiJson(prompt);
    if (geminiRaw) {
      const parsed = safeParseJson<{
        score?: number;
        feedback?: string;
        suggestion?: string;
        dimensions?: { empathy?: number; structure?: number; decisiveness?: number };
        evidence?: string[];
        confidence?: number;
      }>(geminiRaw);

      if (parsed?.dimensions) {
        const answerLength = body.answer.trim().length;
        const modelWeight = answerLength >= 120 ? 0.45 : answerLength >= 80 ? 0.35 : 0.2;
        const blend = (modelValue: number, localValue: number) =>
          clamp(Math.round(localValue * (1 - modelWeight) + modelValue * modelWeight), 0, 100);

        let blendedScore = blend(Number(parsed.score ?? fallback.score), fallback.score);
        const blendedEmpathy = blend(Number(parsed.dimensions.empathy ?? fallback.dimensions.empathy), fallback.dimensions.empathy);
        const blendedStructure = blend(
          Number(parsed.dimensions.structure ?? fallback.dimensions.structure),
          fallback.dimensions.structure
        );
        const blendedDecisiveness = blend(
          Number(parsed.dimensions.decisiveness ?? fallback.dimensions.decisiveness),
          fallback.dimensions.decisiveness
        );

        if (quality.gibberishLike) blendedScore = 0;
        else if (quality.overlapCount === 0) blendedScore = Math.min(blendedScore, 8);
        else if (quality.overlapCount === 1) blendedScore = Math.min(blendedScore, 24);
        if (!quality.hasActionSignal || !quality.hasOrderSignal) blendedScore = Math.min(blendedScore, 42);

        return NextResponse.json({
          score: blendedScore,
          feedback: answerLength < 40 ? fallback.feedback : parsed.feedback || fallback.feedback,
          suggestion: parsed.suggestion || fallback.suggestion,
          dimensions: {
            empathy: blendedEmpathy,
            structure: blendedStructure,
            decisiveness: blendedDecisiveness,
          },
          evidence: Array.isArray(parsed.evidence) && parsed.evidence.length ? parsed.evidence.slice(0, 4) : fallback.evidence,
          confidence: clamp(Number((Number(parsed.confidence ?? 0.8) * (0.75 + quality.qualityScore / 400)).toFixed(2)), 0.45, 1),
        });
      }
    }

    return NextResponse.json(fallback);
  }

  if (body.task === 'summary') {
    const fallbackSummary = buildSummaryFallback(body);

    const prompt = [
      'Actua como recruiter senior en HR Tech.',
      'Genera un resumen ejecutivo de 3 frases para decision de entrevista.',
      `Rol: ${body.role || 'n/a'}`,
      `Scores: ${JSON.stringify(body.scores || {})}`,
      `Metrics: ${JSON.stringify(body.metrics || {})}`,
      `Estrategia dominante: ${body.strategyProfile || 'n/a'}`,
      `Arquetipo: ${body.personalityProfile || 'n/a'}`,
      'Responde JSON con formato: {"summary":"texto"}',
    ].join('\n');

    const geminiRaw = await callGeminiJson(prompt);
    if (geminiRaw) {
      const parsed = safeParseJson<{ summary?: string }>(geminiRaw);
      if (parsed?.summary) {
        return NextResponse.json({ summary: parsed.summary });
      }
    }

    return NextResponse.json({ summary: fallbackSummary });
  }

  return NextResponse.json({ error: 'Unsupported task' }, { status: 400 });
}
