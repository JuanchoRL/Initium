import type {
  AdminWorkspace,
  AssessmentImportRecord,
  CandidateResult,
  CandidateStatus,
  JobOpening,
} from '@/types/admin-dashboard';
import {
  buildAssessmentSummary,
  buildAssessmentSummaryFromCategories,
  resolveJobScoreProfile,
} from '@/lib/admin-dashboard/vacancy-scoring';

export { buildAssessmentSummary } from '@/lib/admin-dashboard/vacancy-scoring';

const DEFAULT_WORKSPACE: AdminWorkspace = {
  organizationName: 'Workspace de recruiting',
  ownerName: 'Administrador',
  ownerRole: 'Equipo de RRHH',
  jobs: [],
  candidates: [],
  invites: [],
};

export function createEmptyWorkspace(): AdminWorkspace {
  return {
    ...DEFAULT_WORKSPACE,
    jobs: [],
    candidates: [],
    invites: [],
  };
}

export function buildCandidateFromAssessment({
  record,
  job,
  recruiter,
}: {
  record: AssessmentImportRecord;
  job: JobOpening;
  recruiter: string;
}): CandidateResult {
  const now = new Date().toISOString();
  const scoreSummary = buildAssessmentSummary(record.scores, resolveJobScoreProfile(job));

  return {
    id: `candidate-${record.id}`,
    name: record.candidateName,
    email: record.candidateEmail,
    phone: '',
    vacancyId: job.id,
    vacancy: job.title,
    department: job.department,
    totalScore: scoreSummary.totalScore,
    technicalScore: scoreSummary.technicalScore,
    cognitiveScore: scoreSummary.cognitiveScore,
    softSkillsScore: scoreSummary.softSkillsScore,
    fitScores: scoreSummary.fitScores,
    status: 'pending',
    pipelineStage: 'assessment',
    appliedAt: record.completedAt,
    updatedAt: now,
    location: 'Sin ubicación',
    recruiter,
    source: 'assessment',
    assessmentId: record.id,
    strategyProfile: record.strategyProfile,
    personalityProfile: record.personalityProfile,
    personalitySubtype: record.personalitySubtype,
    rawScores: record.scores,
    scoreProfileId: scoreSummary.scoreProfileId,
    recruiterNotes: '',
  };
}

export function buildManualCandidateSummaryForJob({
  job,
  technicalScore,
  cognitiveScore,
  softSkillsScore,
}: {
  job: JobOpening;
  technicalScore: number | null;
  cognitiveScore: number | null;
  softSkillsScore: number | null;
}) {
  return buildAssessmentSummaryFromCategories(
    {
      technicalScore,
      cognitiveScore,
      softSkillsScore,
    },
    resolveJobScoreProfile(job)
  );
}

export function normalizeCandidateStatus(status: CandidateStatus, stage: CandidateResult['pipelineStage']) {
  if (stage === 'hired') return 'hired';
  return status;
}
