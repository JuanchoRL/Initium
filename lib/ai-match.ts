import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CandidateResult, JobOpening } from '@/types/admin-dashboard';

// ---------- Configuration ----------
// Models ordered by preference. If the first is overloaded (503), we try the next.
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000; // 2s, 4s, 8s exponential backoff

// ---------- Helpers ----------

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no detectada. Por favor configúrala en el archivo .env.local y reinicia el servidor (npm run dev).'
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

function cleanJsonResponse(text: string): string {
  return text
    .replace(/^[\s]*```json[\s]*/i, '')
    .replace(/^[\s]*```[\s]*/i, '')
    .replace(/[\s]*```[\s]*$/i, '')
    .trim();
}

/**
 * Retry wrapper: tries each model in GEMINI_MODELS, with exponential backoff
 * on 503 / 429 errors. This makes the system resilient to temporary overload.
 */
async function generateWithRetry(prompt: string): Promise<string> {
  const genAI = getGenAI();

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[AI Match] Trying ${modelName} (attempt ${attempt}/${MAX_RETRIES})…`);
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        console.log(`[AI Match] Success with ${modelName}.`);
        return text;
      } catch (error: any) {
        const status = error?.status ?? error?.httpStatusCode ?? 0;
        const msg: string = error?.message ?? '';
        const isRetryable = status === 503 || status === 429 || msg.includes('503') || msg.includes('429') || msg.includes('high demand');

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[AI Match] ${modelName} returned ${status || 'overloaded'}. Retrying in ${delay}ms…`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        // If last attempt for this model, break and try the next model
        if (isRetryable) {
          console.warn(`[AI Match] ${modelName} exhausted retries. Trying next model…`);
          break;
        }

        // Non-retryable error → throw immediately
        throw error;
      }
    }
  }

  throw new Error(
    'Todos los modelos de IA están temporalmente saturados. Por favor inténtalo de nuevo en unos minutos.'
  );
}

// ---------- Single candidate match ----------

export async function computeAiMatch(candidate: CandidateResult, job: JobOpening) {
  const prompt = `
    Eres un experto "Recruiter AI" y evaluador de talento.
    
    A continuación se presenta la descripción de una vacante (Job Description) y los puntajes gamificados de un candidato.
    Debes analizar el perfil del candidato basado en sus habilidades y determinar un "Match Score" de compatibilidad (0 a 100).
    También debes proveer una justificación breve, concisa y muy profesional de no más de 3 líneas sobre POR QUÉ (razón de afinidad), destacando las fortalezas y debilidades.
    
    VACANTE:
    Título: ${job.title}
    Departamento: ${job.department}
    Descripción: ${job.jobDescription || 'No provista'}
    Requisito Clave: ${job.scoreProfileId}
    
    CANDIDATO:
    Puntaje Técnico: ${candidate.technicalScore} / 100
    Puntaje Cognitivo: ${candidate.cognitiveScore} / 100
    Habilidades Blandas (Soft Skills): ${candidate.softSkillsScore} / 100
    
    Perfil Estratégico (Juegos): ${candidate.strategyProfile || 'N/A'}
    Perfil de Personalidad: ${candidate.personalityProfile || 'N/A'}
    
    IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON en este formato. No devuelvas markdown (\`\`\`json) ni texto extra, simplemente el objeto de texto parseable.
    {
      "aiMatchScore": 85,
      "aiMatchReason": "El candidato tiene una gran afinidad por su alto desempeño cognitivo y soft skills excepcionales, ideal para roles de liderazgo. Su única debilidad es el puntaje técnico."
    }
  `;

  try {
    const text = await generateWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonResponse(text));

    return {
      aiMatchScore: parsed.aiMatchScore || 0,
      aiMatchReason: parsed.aiMatchReason || '',
    };
  } catch (error: any) {
    console.error('Error in computeAiMatch:', error);
    throw new Error(error.message || 'No se pudo completar el análisis de la Inteligencia Artificial.');
  }
}

// ---------- Bulk pipeline ranking ----------

export type CandidateRankResult = {
  candidateId: string;
  aiMatchScore: number;
  aiMatchReason: string;
};

export async function rankPipelineWithAi(
  candidates: CandidateResult[],
  job: JobOpening
): Promise<CandidateRankResult[]> {
  if (!candidates.length) return [];

  // Limit to max 30 candidates per call
  const slicedCandidates = candidates.slice(0, 30);

  const candidatesData = slicedCandidates
    .map(
      (c) => `
    ID: ${c.id}
    Nombre: ${c.name}
    Score Técnico: ${c.technicalScore} / 100
    Score Cognitivo: ${c.cognitiveScore} / 100
    Soft Skills: ${c.softSkillsScore} / 100
    Estrategia: ${c.strategyProfile || 'N/A'}
    Personalidad: ${c.personalityProfile || 'N/A'}
  `
    )
    .join('\n---\n');

  const prompt = `
    Eres un experto "Recruiter AI" y evaluador de talento.
    A continuación se presenta la descripción de una vacante y una lista de perfiles de candidatos.
    Debes analizar a CADA candidato frente a los requisitos y determinar su respectivo "Match Score" de compatibilidad (0 a 100) y una justificación concisa (máximo 2 líneas por candidato, enfocada en fortalezas/debilidades).

    VACANTE:
    Título: ${job.title}
    Departamento: ${job.department}
    Descripción: ${job.jobDescription || 'No provista'}
    Requisito Clave: ${job.scoreProfileId}

    CANDIDATOS A EVALUAR:
    ${candidatesData}

    IMPORTANTE: Responde ÚNICAMENTE con un array en JSON válido y estricto, que coincida con esta estructura:
    [
      {
        "candidateId": "ID_DEL_CANDIDATO_PROVISTO",
        "aiMatchScore": 85,
        "aiMatchReason": "Destaca en aspectos cognitivos y estrategia, pero carece de un perfil técnico profundo."
      }
    ]
  `;

  try {
    const text = await generateWithRetry(prompt);
    const parsed = JSON.parse(cleanJsonResponse(text));
    if (!Array.isArray(parsed)) throw new Error('La IA no devolvió un formato de lista válido.');

    return parsed.map((item: any) => ({
      candidateId: item.candidateId,
      aiMatchScore: Number(item.aiMatchScore) || 0,
      aiMatchReason: String(item.aiMatchReason || ''),
    }));
  } catch (error: any) {
    console.error('Error in rankPipelineWithAi:', error);
    throw new Error(error.message || 'No se pudo generar el Ranking Masivo con IA.');
  }
}
