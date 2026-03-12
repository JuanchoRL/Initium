import type { LucideIcon } from 'lucide-react';

export type AdminView =
  | 'dashboard'
  | 'candidates'
  | 'jobs'
  | 'pipeline'
  | 'interviews'
  | 'assessments'
  | 'audit'
  | 'reports'
  | 'settings';

export type CandidateStatus = 'active' | 'pending' | 'rejected' | 'shortlisted' | 'hired';
export type CandidatePipelineStage = 'applied' | 'screening' | 'assessment' | 'interview' | 'final-review' | 'hired';
export type CandidateSource = 'manual' | 'assessment';
export type VacancyRecommendation = 'recommended' | 'reserve' | 'no-advance';
export type JobStatus = 'active' | 'pending' | 'draft';
export type InterviewStatus = 'confirmed' | 'pending' | 'rescheduled';
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';
export type FilterKind = 'all' | 'department' | 'job';

export type NavItem = {
  key: AdminView;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export type KpiMetric = {
  id: string;
  title: string;
  value: string;
  delta: number | null;
  improvesWhen: 'higher' | 'lower';
  icon: LucideIcon;
  caption: string;
};

export type PipelineStage = {
  id: CandidatePipelineStage;
  label: string;
  count: number;
  conversion: number;
  color: string;
};

export type CandidateFitScores = {
  technicalMatch: number;
  cognitivePerformance: number;
  behavioralFit: number;
  communication: number;
  leadershipPotential: number;
  cultureFit: number;
};

export type VacancyScoreProfileId =
  | 'generalist'
  | 'engineering'
  | 'data'
  | 'product'
  | 'customer'
  | 'sales'
  | 'people'
  | 'operations';

export type VacancyScoreProfile = {
  id: VacancyScoreProfileId;
  label: string;
  description: string;
  scoreWeights: {
    memory: number;
    leadership: number;
    problemSolving: number;
    risk: number;
    network: number;
    strategy: number;
  };
  categoryWeights: {
    technicalScore: number;
    cognitiveScore: number;
    softSkillsScore: number;
  };
};

export type CandidateResult = {
  id: string;
  name: string;
  email: string;
  vacancyId: string;
  vacancy: string;
  department: string;
  totalScore: number | null;
  technicalScore: number | null;
  cognitiveScore: number | null;
  softSkillsScore: number | null;
  fitScores: CandidateFitScores | null;
  status: CandidateStatus;
  pipelineStage: CandidatePipelineStage;
  appliedAt: string;
  updatedAt: string;
  location: string;
  recruiter: string;
  source: CandidateSource;
  assessmentId?: string;
  strategyProfile?: string;
  personalityProfile?: string;
  rawScores?: Record<string, number>;
  hiredAt?: string;
  scoreProfileId?: VacancyScoreProfileId;
  shortlistManual?: boolean;
  vacancyRecommendation?: VacancyRecommendation;
  vacancyRecommendationSource?: 'system' | 'manual';
};

export type JobOpening = {
  id: string;
  title: string;
  department: string;
  location: string;
  status: JobStatus;
  owner: string;
  postedAt: string;
  scoreProfileId: VacancyScoreProfileId;
};

export type JobOpeningWithStats = JobOpening & {
  appliedCount: number;
  assessmentCount: number;
  interviewCount: number;
  hiredCount: number;
  shortlistedCount: number;
  recommendedCount: number;
  reserveCount: number;
  noAdvanceCount: number;
};

export type UpcomingInterview = {
  id: string;
  candidateId: string;
  candidateName: string;
  vacancyId: string;
  vacancy: string;
  department: string;
  scheduledAt: string;
  interviewer: string;
  status: InterviewStatus;
  format: 'Video' | 'On-site';
};

export type AlertItem = {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  meta: string;
  actionLabel: string;
};

export type FitScoreCategory = {
  id: string;
  label: string;
  value: number;
  note: string;
};

export type FilterOption = {
  value: string;
  label: string;
  kind: FilterKind;
};

export type ReportCard = {
  id: string;
  title: string;
  value: string;
  delta: string;
  description: string;
};

export type AdminWorkspace = {
  organizationName: string;
  ownerName: string;
  ownerRole: string;
  jobs: JobOpening[];
  candidates: CandidateResult[];
  interviews: UpcomingInterview[];
};

export type AssessmentImportRecord = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  completedAt: string;
  strategyProfile?: string;
  personalityProfile?: string;
  scores: Record<string, number>;
  metrics: Record<string, Record<string, number | string | boolean>>;
  totalScore: number;
  technicalScore: number;
  cognitiveScore: number;
  softSkillsScore: number;
  fitScores: CandidateFitScores;
  importedCandidateId?: string | null;
  scoreProfileId?: VacancyScoreProfileId;
};

export type RecruiterAuditSession = {
  sessionId: string;
  recruiterName: string;
  recruiterEmail: string;
  status: 'active' | 'closed';
  startedAt: string;
  endedAt?: string | null;
  lastSeenAt: string;
  userAgent?: string | null;
};

export type RecruiterAuditEvent = {
  id: string;
  sessionId: string;
  recruiterName: string;
  recruiterEmail: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  details?: string | null;
  occurredAt: string;
};

export type RecruiterAuditBundle = {
  activeSessions: RecruiterAuditSession[];
  recentAccesses: RecruiterAuditSession[];
  recentClosures: RecruiterAuditSession[];
  recentEvents: RecruiterAuditEvent[];
};
