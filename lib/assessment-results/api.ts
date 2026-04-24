import type { AssessmentImportRecord } from '@/types/admin-dashboard';

export async function persistAssessmentResult(payload: AssessmentImportRecord) {
  const response = await fetch('/api/assessment-results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'No se pudo persistir el resultado del assessment';
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }

  return (await response.json()) as { results: AssessmentImportRecord[] };
}
