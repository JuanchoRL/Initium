import type {
  AdminWorkspace,
  AssessmentImportRecord,
  CandidatePipelineStage,
  CandidateResult,
  CandidateStatus,
  RecruiterAuditBundle,
  UpcomingInterview,
  VacancyRecommendation,
  VacancyScoreProfileId,
} from '@/types/admin-dashboard';
import type { RecruiterAccessSession } from '@/lib/admin-dashboard/recruiter-session';

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchAdminWorkspace() {
  return request<{ workspace: AdminWorkspace }>('/api/admin/workspace', { cache: 'no-store' });
}

export async function fetchAdminAssessmentResults() {
  return request<{ results: AssessmentImportRecord[] }>('/api/admin/assessment-results', { cache: 'no-store' });
}

export async function saveAdminWorkspaceSettings(payload: Pick<AdminWorkspace, 'organizationName' | 'ownerName' | 'ownerRole'>) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/workspace', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createAdminJob(payload: {
  title: string;
  department: string;
  location: string;
  owner?: string;
  scoreProfileId?: VacancyScoreProfileId;
}) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createAdminCandidate(payload: CandidateResult) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/candidates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminCandidate(payload: {
  id: string;
  status: CandidateStatus;
  pipelineStage: CandidatePipelineStage;
  shortlistManual?: boolean;
  vacancyRecommendation?: VacancyRecommendation;
}) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/candidates', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createAdminInterview(payload: UpcomingInterview) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/interviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startRecruiterAccess(payload: { name: string; email: string }) {
  return request<{ session: RecruiterAccessSession }>('/api/admin/recruiter-access', {
    method: 'POST',
    body: JSON.stringify({
      action: 'login',
      name: payload.name,
      email: payload.email,
    }),
  });
}

export async function endRecruiterAccess(payload: { sessionId: string; name: string; email: string }) {
  return request<{ ok: true }>('/api/admin/recruiter-access', {
    method: 'POST',
    body: JSON.stringify({
      action: 'logout',
      sessionId: payload.sessionId,
      name: payload.name,
      email: payload.email,
    }),
  });
}

export async function fetchRecruiterAudit() {
  return request<{ audit: RecruiterAuditBundle }>('/api/admin/recruiter-audit', { cache: 'no-store' });
}

export async function recordRecruiterActivity(payload: {
  sessionId: string;
  recruiterName: string;
  recruiterEmail: string;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  details?: string;
}) {
  return request<{ ok: true }>('/api/admin/recruiter-audit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
