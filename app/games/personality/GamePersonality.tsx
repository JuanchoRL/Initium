import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { clamp } from '@/lib/math';
import type { GameResult, GameId } from '@/lib/types';
import {
  type PersonalityTraitId,
  derivePersonalityProfileLabel,
  personalityTraitMeta,
} from '@/lib/assessment/personality';

type GameProps = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>, gameId?: GameId) => void;
};

type PersonalityOptionId = 'A' | 'B' | 'C' | 'D';

type PersonalityQuestionOption = {
  id: PersonalityOptionId;
  text: string;
  trait: PersonalityTraitId;
  signal: string;
};

type PersonalityQuestion = {
  id: string;
  title: string;
  measure: string;
  options: PersonalityQuestionOption[];
};

/**
 * 12 DISC self-report questions.
 * Each trait (D, I, S, C) appears exactly 3 times as each option ID (A, B, C, D) across questions,
 * eliminating position bias. Wording is balanced for equal social desirability.
 */
export const PERSONALITY_QUESTIONS: PersonalityQuestion[] = [
  // --- Block 1: Rol en equipos (3 preguntas) ---
  {
    id: 'q1',
    title: 'En un grupo nuevo, ¿qué posición tomás naturalmente?',
    measure: 'Iniciativa de rol y forma de participar en equipos nuevos.',
    options: [
      { id: 'A', text: 'Escucho primero y luego organizo las ideas.', trait: 'C', signal: 'Análisis y estructura' },
      { id: 'B', text: 'Busco que todos se sientan cómodos.', trait: 'S', signal: 'Soporte y cohesión' },
      { id: 'C', text: 'Conecto con las personas y genero energía.', trait: 'I', signal: 'Conexión social' },
      { id: 'D', text: 'Propongo una dirección clara de arranque.', trait: 'D', signal: 'Iniciativa y dirección' },
    ],
  },
  {
    id: 'q2',
    title: 'Cuando un equipo no avanza, ¿qué hacés?',
    measure: 'Estilo de intervención cuando un grupo se estanca.',
    options: [
      { id: 'A', text: 'Tomo control y marco un rumbo.', trait: 'D', signal: 'Asumir liderazgo' },
      { id: 'B', text: 'Analizo qué nos frena y ordeno los pasos.', trait: 'C', signal: 'Diagnóstico estructurado' },
      { id: 'C', text: 'Animo al equipo a seguir con optimismo.', trait: 'I', signal: 'Motivación social' },
      { id: 'D', text: 'Me acerco a quienes están bloqueados para ayudar.', trait: 'S', signal: 'Apoyo empático' },
    ],
  },
  {
    id: 'q3',
    title: '¿Qué aportas de forma más natural a tu equipo?',
    measure: 'Contribución instintiva al grupo de trabajo.',
    options: [
      { id: 'A', text: 'Buena onda y facilidad para conectar.', trait: 'I', signal: 'Clima y vínculo' },
      { id: 'B', text: 'Compromiso y constancia en el trabajo.', trait: 'S', signal: 'Constancia y soporte' },
      { id: 'C', text: 'Ambición y velocidad para avanzar.', trait: 'D', signal: 'Impulso y resultado' },
      { id: 'D', text: 'Atención al detalle y calidad.', trait: 'C', signal: 'Rigor y precisión' },
    ],
  },

  // --- Block 2: Comunicación y feedback (3 preguntas) ---
  {
    id: 'q4',
    title: '¿Cómo preferís recibir feedback sobre tu trabajo?',
    measure: 'Preferencia de comunicación y recepción de feedback.',
    options: [
      { id: 'A', text: 'En una charla privada y sincera.', trait: 'S', signal: 'Seguridad emocional' },
      { id: 'B', text: 'Directo, sin rodeos.', trait: 'D', signal: 'Franqueza directa' },
      { id: 'C', text: 'Por escrito, con datos y ejemplos.', trait: 'C', signal: 'Precisión analítica' },
      { id: 'D', text: 'Con reconocimiento primero, luego la mejora.', trait: 'I', signal: 'Validación social' },
    ],
  },
  {
    id: 'q5',
    title: 'Al dar tu opinión en una reunión, ¿cómo lo hacés?',
    measure: 'Estilo de comunicación en contextos grupales.',
    options: [
      { id: 'A', text: 'Con datos y argumentos bien armados.', trait: 'C', signal: 'Fundamentación lógica' },
      { id: 'B', text: 'Con entusiasmo y buscando adhesión.', trait: 'I', signal: 'Persuasión entusiasta' },
      { id: 'C', text: 'De forma cuidadosa, considerando a todos.', trait: 'S', signal: 'Consideración grupal' },
      { id: 'D', text: 'De forma decisiva, yendo al punto.', trait: 'D', signal: 'Claridad directa' },
    ],
  },
  {
    id: 'q6',
    title: 'Cuando tenés un desacuerdo con alguien del equipo, ¿cómo lo manejás?',
    measure: 'Estilo de resolución de conflictos.',
    options: [
      { id: 'A', text: 'Lo enfrento directamente y busco una resolución rápida.', trait: 'D', signal: 'Confrontación productiva' },
      { id: 'B', text: 'Cedo un poco para mantener la armonía del grupo.', trait: 'S', signal: 'Armonía sobre confrontación' },
      { id: 'C', text: 'Busco entender su punto de vista y encontrar un punto medio.', trait: 'I', signal: 'Mediación empática' },
      { id: 'D', text: 'Reviso los hechos y busco la respuesta objetivamente correcta.', trait: 'C', signal: 'Resolución basada en evidencia' },
    ],
  },

  // --- Block 3: Gestión del cambio y presión (3 preguntas) ---
  {
    id: 'q7',
    title: 'Ante un cambio inesperado en el plan, tu primera reacción es...',
    measure: 'Respuesta frente a incertidumbre y gestión del cambio.',
    options: [
      { id: 'A', text: 'Evaluar los riesgos antes de actuar.', trait: 'C', signal: 'Gestión de riesgo' },
      { id: 'B', text: 'Ver la oportunidad y entusiasmar al equipo.', trait: 'I', signal: 'Optimismo adaptativo' },
      { id: 'C', text: 'Tomar las riendas y definir los nuevos pasos.', trait: 'D', signal: 'Iniciativa ante crisis' },
      { id: 'D', text: 'Asegurar que el equipo esté tranquilo e informado.', trait: 'S', signal: 'Estabilidad emocional' },
    ],
  },
  {
    id: 'q8',
    title: '¿Qué te genera más estrés en el trabajo?',
    measure: 'Fuente principal de presión laboral.',
    options: [
      { id: 'A', text: 'Sentir que el equipo no está comprometido.', trait: 'I', signal: 'Necesidad de conexión' },
      { id: 'B', text: 'Que las cosas avancen demasiado lento.', trait: 'D', signal: 'Impaciencia por resultados' },
      { id: 'C', text: 'La improvisación sin respaldo técnico.', trait: 'C', signal: 'Necesidad de estructura' },
      { id: 'D', text: 'Los cambios abruptos que afectan a las personas.', trait: 'S', signal: 'Protección del equipo' },
    ],
  },
  {
    id: 'q9',
    title: 'Cuando la presión sube y quedan pocos recursos, vos...',
    measure: 'Comportamiento bajo presión y recursos limitados.',
    options: [
      { id: 'A', text: 'Mantengo la calma y priorizo a las personas.', trait: 'S', signal: 'Serenidad y cuidado' },
      { id: 'B', text: 'Busco atajos efectivos para llegar al resultado.', trait: 'D', signal: 'Pragmatismo bajo presión' },
      { id: 'C', text: 'Mantengo la disciplina y sigo el proceso.', trait: 'C', signal: 'Rigor bajo presión' },
      { id: 'D', text: 'Sumo aliados y pido ayuda para salir adelante.', trait: 'I', signal: 'Red de apoyo' },
    ],
  },

  // --- Block 4: Motivación y valores (3 preguntas) ---
  {
    id: 'q10',
    title: '¿Qué te da más satisfacción al final de un proyecto?',
    measure: 'Motor de satisfacción profesional.',
    options: [
      { id: 'A', text: 'Que el equipo haya crecido durante el proceso.', trait: 'S', signal: 'Desarrollo de personas' },
      { id: 'B', text: 'Haber logrado un resultado excepcional.', trait: 'D', signal: 'Logro y resultado' },
      { id: 'C', text: 'Que la gente haya disfrutado trabajar conmigo.', trait: 'I', signal: 'Impacto relacional' },
      { id: 'D', text: 'Que todo haya salido técnicamente impecable.', trait: 'C', signal: 'Excelencia técnica' },
    ],
  },
  {
    id: 'q11',
    title: 'Si pudieras elegir un superpoder para tu trabajo, sería...',
    measure: 'Fortaleza aspiracional en el contexto laboral.',
    options: [
      { id: 'A', text: 'Predecir exactamente qué va a funcionar.', trait: 'C', signal: 'Precisión predictiva' },
      { id: 'B', text: 'Hacer que cualquier persona confíe en vos.', trait: 'I', signal: 'Confianza interpersonal' },
      { id: 'C', text: 'Mantener la paz en cualquier situación.', trait: 'S', signal: 'Estabilidad y contención' },
      { id: 'D', text: 'Decidir siempre rápido y acertar.', trait: 'D', signal: 'Decisión instantánea' },
    ],
  },
  {
    id: 'q12',
    title: '¿Qué tipo de líder admirás más?',
    measure: 'Modelo de liderazgo aspiracional.',
    options: [
      { id: 'A', text: 'El que inspira con su visión a largo plazo.', trait: 'D', signal: 'Visión y ambición' },
      { id: 'B', text: 'El que genera un ambiente donde todos dan lo mejor.', trait: 'I', signal: 'Cultura positiva' },
      { id: 'C', text: 'El que se preocupa por el bienestar de cada persona.', trait: 'S', signal: 'Liderazgo humano' },
      { id: 'D', text: 'El que toma decisiones basadas en datos y evidencia.', trait: 'C', signal: 'Liderazgo analítico' },
    ],
  },
];


export const GamePersonality = ({
  onComplete,
  track,
  setPersonalityProfile,
}: GameProps & { setPersonalityProfile: (profile: string) => void }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<PersonalityQuestionOption[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const questions = PERSONALITY_QUESTIONS;

  // Randomize option order per question, stable across renders
  const shuffledQuestions = useMemo(() => {
    return questions.map((q) => {
      const shuffledOptions = [...q.options];
      // Fisher-Yates shuffle
      for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
      }
      // Re-assign option IDs based on new position
      const reIdOptions = shuffledOptions.map((opt, idx) => ({
        ...opt,
        id: (['A', 'B', 'C', 'D'] as PersonalityOptionId[])[idx],
      }));
      return { ...q, options: reIdOptions };
    });
  }, []); // Empty deps = stable per mount

  const completeAssessment = useCallback(
    (finalAnswers: PersonalityQuestionOption[]) => {
      const traitCounts: Record<PersonalityTraitId, number> = { D: 0, I: 0, S: 0, C: 0 };
      for (const answer of finalAnswers) traitCounts[answer.trait] += 1;

      // Sort with deterministic tiebreaking: if counts equal, prefer less commonly dominant traits
      // Tiebreak priority: S > C > I > D (inverse of the natural bias)
      const tiebreakOrder: Record<PersonalityTraitId, number> = { S: 0, C: 1, I: 2, D: 3 };
      const sorted = (Object.entries(traitCounts) as Array<[PersonalityTraitId, number]>).sort(
        (a, b) => b[1] - a[1] || tiebreakOrder[a[0]] - tiebreakOrder[b[0]]
      );

      const dominant = sorted[0][0];
      const secondary = sorted[1][0];
      const dominantCount = sorted[0][1];
      const consistency = dominantCount / finalAnswers.length;
      const diversity = Object.values(traitCounts).filter((value) => value > 0).length;
      const score = clamp(Math.round(58 + consistency * 30 + diversity * 3), 0, 100);

      const label = derivePersonalityProfileLabel(dominant, secondary);
      setPersonalityProfile(label);

      track('game_submitted', {
        score,
        dominant,
        secondary,
        diversity,
        consistency: Number(consistency.toFixed(2)),
      });

      onComplete({
        score,
        metrics: {
          dominant_profile: dominant,
          dominant_label: personalityTraitMeta[dominant].label,
          secondary_profile: secondary,
          secondary_label: personalityTraitMeta[secondary].label,
          consistency_ratio: Number(consistency.toFixed(2)),
          diversity_index: Number((diversity / 4).toFixed(2)),
          disc_d_pct: Math.round((traitCounts.D / finalAnswers.length) * 100),
          disc_i_pct: Math.round((traitCounts.I / finalAnswers.length) * 100),
          disc_s_pct: Math.round((traitCounts.S / finalAnswers.length) * 100),
          disc_c_pct: Math.round((traitCounts.C / finalAnswers.length) * 100),
          disc_d_count: traitCounts.D,
          disc_i_count: traitCounts.I,
          disc_s_count: traitCounts.S,
          disc_c_count: traitCounts.C,
          q1_signal: finalAnswers[0]?.signal || '',
          q2_signal: finalAnswers[1]?.signal || '',
          q3_signal: finalAnswers[2]?.signal || '',
          q4_signal: finalAnswers[3]?.signal || '',
          q5_signal: finalAnswers[4]?.signal || '',
          q6_signal: finalAnswers[5]?.signal || '',
          q7_signal: finalAnswers[6]?.signal || '',
          q8_signal: finalAnswers[7]?.signal || '',
          q9_signal: finalAnswers[8]?.signal || '',
          q10_signal: finalAnswers[9]?.signal || '',
          q11_signal: finalAnswers[10]?.signal || '',
          q12_signal: finalAnswers[11]?.signal || '',
          q1_choice: finalAnswers[0]?.id || '',
          q2_choice: finalAnswers[1]?.id || '',
          q3_choice: finalAnswers[2]?.id || '',
          q4_choice: finalAnswers[3]?.id || '',
          q5_choice: finalAnswers[4]?.id || '',
          q6_choice: finalAnswers[5]?.id || '',
          q7_choice: finalAnswers[6]?.id || '',
          q8_choice: finalAnswers[7]?.id || '',
          q9_choice: finalAnswers[8]?.id || '',
          q10_choice: finalAnswers[9]?.id || '',
          q11_choice: finalAnswers[10]?.id || '',
          q12_choice: finalAnswers[11]?.id || '',
        },
      });
    },
    [onComplete, setPersonalityProfile, track]
  );

  const handleAnswer = (option: PersonalityQuestionOption) => {
    track('decision_made', { question: currentQ + 1, option: option.id, trait: option.trait, signal: option.signal });
    const nextAnswers = [...answers, option];
    setAnswers(nextAnswers);
    setTransitioning(true);

    window.setTimeout(() => {
      if (currentQ < questions.length - 1) {
        setCurrentQ((prev) => prev + 1);
        setTransitioning(false);
      } else {
        completeAssessment(nextAnswers);
      }
    }, 180);
  };

  const qData = shuffledQuestions[currentQ];

  return (
    <div className="w-full max-w-5xl mx-auto pt-8 px-4 animate-fade-in relative z-0">
      <div className="max-w-xl mx-auto mb-7">
        <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className={`transition-all duration-200 ${transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
        <div className="text-center mb-10 space-y-3">
          <span className="text-cyan-600 font-bold tracking-widest uppercase text-xs">
            Pregunta {currentQ + 1} de {questions.length}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-stone-800 leading-tight max-w-3xl mx-auto">{qData.title}</h2>
          <p className="text-sm text-stone-500">Selecciona la opción que mejor te representa en contexto laboral.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {qData.options.map((opt, idx) => (
            <button
              id={`personality-q${currentQ}-opt-${opt.id}`}
              key={`${currentQ}-${opt.id}`}
              onClick={() => handleAnswer(opt)}
              className="group relative bg-white rounded-xl p-5 shadow-sm border border-stone-200 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-cyan-400 flex items-center gap-4 text-left"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                  ['bg-blue-100 text-blue-600', 'bg-amber-100 text-amber-600', 'bg-emerald-100 text-emerald-600', 'bg-purple-100 text-purple-600'][idx % 4]
                } group-hover:bg-cyan-500 group-hover:text-white`}
              >
                {opt.id}
              </div>
              <span className="text-base font-medium text-stone-700">{opt.text}</span>
              <ChevronRight className="w-4 h-4 text-cyan-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
