'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultsDashboard } from '@/components/dashboard/ResultsDashboard';
import { exportDashboardToPdf } from '@/lib/pdf-export';
import { EMPTY_METRICS, PERFORMANCE_GAME_IDS } from '@/lib/constants';
import type { CandidateResult } from '@/types/admin-dashboard';
import type { CandidateProfile, ScoresMap, MetricsMap } from '@/lib/types';

type Props = {
  candidate: CandidateResult;
  assessmentMetrics?: Record<string, Record<string, number | string | boolean>>;
};

/**
 * Hidden off-screen renderer that creates a full ResultsDashboard
 * and exports it as PDF on demand.
 */
export function CandidatePdfExportButton({ candidate, assessmentMetrics }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const candidateProfile: CandidateProfile = {
    name: candidate.name,
    email: candidate.email,
    role: candidate.vacancy || 'Sin vacante',
    accessType: 'candidate',
    acceptedTerms: true,
    acceptedDataPolicy: true,
  };

  const scores: ScoresMap = {
    personality: candidate.rawScores?.personality ?? 0,
    memory: candidate.rawScores?.memory ?? 0,
    leadership: candidate.rawScores?.leadership ?? 0,
    problemSolving: candidate.rawScores?.problemSolving ?? 0,
    ethics: candidate.rawScores?.ethics ?? 0,
    risk: candidate.rawScores?.risk ?? 0,
    network: candidate.rawScores?.network ?? 0,
    strategy: candidate.rawScores?.strategy ?? 0,
  };

  const metrics: MetricsMap = {
    personality: (assessmentMetrics?.personality ?? EMPTY_METRICS.personality) as MetricsMap['personality'],
    memory: (assessmentMetrics?.memory ?? EMPTY_METRICS.memory) as MetricsMap['memory'],
    leadership: (assessmentMetrics?.leadership ?? EMPTY_METRICS.leadership) as MetricsMap['leadership'],
    problemSolving: (assessmentMetrics?.problemSolving ?? EMPTY_METRICS.problemSolving) as MetricsMap['problemSolving'],
    ethics: (assessmentMetrics?.ethics ?? EMPTY_METRICS.ethics) as MetricsMap['ethics'],
    risk: (assessmentMetrics?.risk ?? EMPTY_METRICS.risk) as MetricsMap['risk'],
    network: (assessmentMetrics?.network ?? EMPTY_METRICS.network) as MetricsMap['network'],
    strategy: (assessmentMetrics?.strategy ?? EMPTY_METRICS.strategy) as MetricsMap['strategy'],
  };

  const handleExport = useCallback(async () => {
    if (isExporting) return;

    // 1. Show the hidden preview
    setShowPreview(true);
    setIsExporting(true);

    // Wait for React to render the preview
    await new Promise<void>((resolve) => window.setTimeout(resolve, 600));

    try {
      const el = containerRef.current;
      if (!el) throw new Error('Preview container not found');

      const filename = `evaluacion-${candidate.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      await exportDashboardToPdf(el, filename);
    } catch (err) {
      console.error('PDF export from recruiter failed', err);
    } finally {
      setIsExporting(false);
      setShowPreview(false);
    }
  }, [candidate.name, isExporting]);

  const hasScores = candidate.rawScores && Object.values(candidate.rawScores).some((v) => v > 0);

  if (!hasScores) return null;

  return (
    <>
      <Button
        variant="outline"
        className="gap-2 text-xs border-cyan-200 text-cyan-700 hover:bg-cyan-50"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando PDF...
          </>
        ) : (
          <>
            <Save className="h-3.5 w-3.5" /> Exportar Informe PDF
          </>
        )}
      </Button>

      {/* Off-screen hidden preview for PDF capture */}
      {showPreview && (
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '1200px',
            zIndex: -1,
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <div ref={containerRef}>
            <ResultsDashboard
              candidate={candidateProfile}
              scores={scores}
              metrics={metrics}
              strategyProfile={candidate.strategyProfile || ''}
              personalityProfile={candidate.personalityProfile || ''}
              onRestart={() => {}}
            />
          </div>
        </div>
      )}
    </>
  );
}
