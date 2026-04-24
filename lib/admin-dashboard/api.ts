import type {
  AdminWorkspace,
  AssessmentInvite,
  AssessmentImportRecord,
  CandidatePipelineStage,
  CandidateResult,
  CandidateStatus,
  JobStatus,
  RecruiterAuditBundle,
  VacancyRecommendation,
  VacancyScoreProfileId,
} from '@/types/admin-dashboard';
import type { RecruiterAccessSession } from '@/lib/admin-dashboard/recruiter-session';
import { readRecruiterAccessSession } from '@/lib/admin-dashboard/recruiter-session';

function adminSessionHeaders() {
  const session = readRecruiterAccessSession();
  if (!session) return {};
  return {
    'x-initium-recruiter-session': session.sessionId,
    'x-initium-recruiter-email': session.email,
  };
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  Object.entries(adminSessionHeaders()).forEach(([key, value]) => headers.set(key, value));

  const response = await fetch(input, {
    ...init,
    headers,
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
  jobDescription?: string;
  status?: JobStatus;
}) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminJob(payload: {
  id: string;
  title?: string;
  department?: string;
  location?: string;
  owner?: string;
  scoreProfileId?: VacancyScoreProfileId;
  jobDescription?: string;
  status?: JobStatus;
}) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/jobs', {
    method: 'PATCH',
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
  vacancyId?: string;
  phone?: string;
  recruiterNotes?: string;
  shortlistManual?: boolean;
  shortlistOrder?: number;
  vacancyRecommendation?: VacancyRecommendation;
}) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/candidates', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createAdminInvite(payload: AssessmentInvite) {
  return request<{ workspace: AdminWorkspace }>('/api/admin/invites', {
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
