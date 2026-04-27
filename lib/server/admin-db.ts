import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  buildAssessmentSummary,
  buildAssessmentSummaryFromCategories,
  inferVacancyScoreProfile,
  resolveJobScoreProfile,
} from '@/lib/admin-dashboard/vacancy-scoring';
import { resolveVacancyRecommendation } from '@/lib/admin-dashboard/recruiter-decisioning';
import type {
  AdminWorkspace,
  AssessmentInvite,
  AssessmentInviteStatus,
  AssessmentImportRecord,
  CandidateFitScores,
  CandidatePipelineStage,
  CandidateResult,
  CandidateStatus,
  JobOpening,
  RecruiterAuditBundle,
  RecruiterAuditEvent,
  RecruiterAuditSession,
  VacancyRecommendation,
  VacancyScoreProfileId,
} from '@/types/admin-dashboard';

const DB_PATH = path.join(process.cwd(), 'data', 'initium-admin.sqlite');

type WorkspaceRow = {
  organization_name: string;
  owner_name: string;
  owner_role: string;
};

type JobRow = {
  id: string;
  title: string;
  department: string;
  location: string;
  status: JobOpening['status'];
  owner: string;
  posted_at: string;
  score_profile_id: VacancyScoreProfileId;
  job_description: string | null;
};

type CandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  vacancy_id: string;
  vacancy: string;
  department: string;
  total_score: number | null;
  technical_score: number | null;
  cognitive_score: number | null;
  soft_skills_score: number | null;
  fit_scores: string | null;
  status: CandidateResult['status'];
  pipeline_stage: CandidateResult['pipelineStage'];
  applied_at: string;
  updated_at: string;
  location: string;
  recruiter: string;
  source: CandidateResult['source'];
  assessment_id: string | null;
  strategy_profile: string | null;
  personality_profile: string | null;
  raw_scores: string | null;
  hired_at: string | null;
  score_profile_id: string | null;
  recruiter_notes: string | null;
  shortlist_manual: number | null;
  shortlist_order: number | null;
  vacancy_recommendation: VacancyRecommendation | null;
  vacancy_recommendation_source: 'system' | 'manual' | null;
  ai_match_score?: number | null;
  ai_match_reason?: string | null;
};

type InviteRow = {
  id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  vacancy_id: string;
  vacancy: string;
  department: string;
  recruiter: string;
  expires_at: string;
  created_at: string;
  status: AssessmentInviteStatus;
};

type AssessmentResultRow = {
  id: string;
  invite_id: string | null;
  candidate_name: string;
  candidate_email: string;
  role: string;
  completed_at: string;
  strategy_profile: string | null;
  personality_profile: string | null;
  scores: string;
  metrics: string;
  total_score: number;
  technical_score: number;
  cognitive_score: number;
  soft_skills_score: number;
  fit_scores: string;
  imported_candidate_id: string | null;
  score_profile_id: string | null;
};

type TableInfoRow = {
  name: string;
};

type RecruiterAccessSessionRow = {
  session_id: string;
  recruiter_name: string;
  recruiter_email: string;
  status: 'active' | 'closed';
  started_at: string;
  ended_at: string | null;
  last_seen_at: string;
  last_user_agent: string | null;
};

type RecruiterActivityEventRow = {
  id: string;
  session_id: string;
  recruiter_name: string;
  recruiter_email: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  details: string | null;
  occurred_at: string;
};

declare global {
  var __initiumAdminDb: DatabaseSync | undefined;
}

function createDatabase() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS workspace_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      organization_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      owner_role TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL,
      owner TEXT NOT NULL,
      posted_at TEXT NOT NULL,
      score_profile_id TEXT NOT NULL DEFAULT 'generalist',
      job_description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      vacancy_id TEXT NOT NULL,
      vacancy TEXT NOT NULL,
      department TEXT NOT NULL,
      total_score INTEGER,
      technical_score INTEGER,
      cognitive_score INTEGER,
      soft_skills_score INTEGER,
      fit_scores TEXT,
      status TEXT NOT NULL,
      pipeline_stage TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      location TEXT NOT NULL,
      recruiter TEXT NOT NULL,
      source TEXT NOT NULL,
      assessment_id TEXT UNIQUE,
      strategy_profile TEXT,
      personality_profile TEXT,
      raw_scores TEXT,
      hired_at TEXT,
      score_profile_id TEXT,
      shortlist_order INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      candidate_id TEXT NOT NULL,
      candidate_name TEXT NOT NULL,
      vacancy_id TEXT NOT NULL,
      vacancy TEXT NOT NULL,
      department TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      interviewer TEXT NOT NULL,
      status TEXT NOT NULL,
      format TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessment_invites (
      id TEXT PRIMARY KEY,
      invite_id TEXT,
      candidate_name TEXT NOT NULL,
      candidate_email TEXT NOT NULL,
      candidate_phone TEXT,
      vacancy_id TEXT NOT NULL,
      vacancy TEXT NOT NULL,
      department TEXT NOT NULL,
      recruiter TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessment_results (
      id TEXT PRIMARY KEY,
      candidate_name TEXT NOT NULL,
      candidate_email TEXT NOT NULL,
      role TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      strategy_profile TEXT,
      personality_profile TEXT,
      scores TEXT NOT NULL,
      metrics TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      technical_score INTEGER NOT NULL,
      cognitive_score INTEGER NOT NULL,
      soft_skills_score INTEGER NOT NULL,
      fit_scores TEXT NOT NULL,
      imported_candidate_id TEXT,
      score_profile_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recruiter_access_sessions (
      session_id TEXT PRIMARY KEY,
      recruiter_name TEXT NOT NULL,
      recruiter_email TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      last_seen_at TEXT NOT NULL,
      last_user_agent TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recruiter_access_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      recruiter_name TEXT NOT NULL,
      recruiter_email TEXT NOT NULL,
      action TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recruiter_activity_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      recruiter_name TEXT NOT NULL,
      recruiter_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      summary TEXT NOT NULL,
      details TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const workspaceExists = db.prepare('SELECT id FROM workspace_settings WHERE id = 1').get() as { id?: number } | undefined;
  if (!workspaceExists?.id) {
    db.prepare(
      `INSERT INTO workspace_settings (id, organization_name, owner_name, owner_role, updated_at)
       VALUES (1, ?, ?, ?, ?)`
    ).run('Workspace de recruiting', 'Administrador', 'Equipo de RRHH', new Date().toISOString());
  }

  ensureColumn(db, 'jobs', 'score_profile_id', "TEXT NOT NULL DEFAULT 'generalist'");
  ensureColumn(db, 'jobs', 'job_description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'candidates', 'score_profile_id', 'TEXT');
  ensureColumn(db, 'candidates', 'phone', 'TEXT');
  ensureColumn(db, 'candidates', 'recruiter_notes', 'TEXT');
  ensureColumn(db, 'candidates', 'shortlist_manual', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'candidates', 'shortlist_order', 'INTEGER');
  ensureColumn(db, 'candidates', 'vacancy_recommendation', 'TEXT');
  ensureColumn(db, 'candidates', 'vacancy_recommendation_source', "TEXT NOT NULL DEFAULT 'system'");
  ensureColumn(db, 'candidates', 'ai_match_score', 'INTEGER');
  ensureColumn(db, 'candidates', 'ai_match_reason', 'TEXT');
  ensureColumn(db, 'assessment_results', 'score_profile_id', 'TEXT');
  ensureColumn(db, 'assessment_results', 'invite_id', 'TEXT');
  seedJobScoreProfiles(db);

  return db;
}

function ensureColumn(db: DatabaseSync, tableName: string, columnName: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[];
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function seedJobScoreProfiles(db: DatabaseSync) {
  const jobs = db.prepare('SELECT id, title, department, score_profile_id FROM jobs').all() as Array<{
    id: string;
    title: string;
    department: string;
    score_profile_id: string | null;
  }>;

  const updateJobScoreProfile = db.prepare(
    `UPDATE jobs
     SET score_profile_id = ?, updated_at = ?
     WHERE id = ?`
  );

  const now = new Date().toISOString();
  for (const job of jobs) {
    if (typeof job.score_profile_id === 'string' && job.score_profile_id.trim()) continue;
    const nextProfileId = inferVacancyScoreProfile({ title: job.title, department: job.department });
    updateJobScoreProfile.run(nextProfileId, now, job.id);
  }
}

function getDb() {
  if (!globalThis.__initiumAdminDb) {
    globalThis.__initiumAdminDb = createDatabase();
  }
  return globalThis.__initiumAdminDb;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const PIPELINE_STAGE_ORDER: CandidatePipelineStage[] = ['applied', 'screening', 'assessment', 'final-review', 'hired'];

function normalizeLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function slugify(value: string) {
  return normalizeLookup(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'sin-rol';
}

function inferDepartmentFromRole(role: string) {
  const normalized = normalizeLookup(role);
  if (/(backend|frontend|fullstack|software|data|devops|ingenier|desarroll)/.test(normalized)) return 'Engineering';
  if (/(product|producto|ux|ui|design|diseno)/.test(normalized)) return 'Product';
  if (/(ventas|sales|account|comercial|business development)/.test(normalized)) return 'Sales';
  if (/(customer|support|success|soporte|clientes)/.test(normalized)) return 'Customer Success';
  if (/(people|rrhh|human|talent|recruit|reclut)/.test(normalized)) return 'People';
  if (/(marketing|growth|brand|contenido)/.test(normalized)) return 'Marketing';
  if (/(finance|finanzas|legal|operations|ops|operaciones)/.test(normalized)) return 'Operations';
  return 'General';
}

function stageRank(stage: CandidatePipelineStage) {
  return PIPELINE_STAGE_ORDER.indexOf(stage);
}

function clampPipelineStage(currentStage: CandidatePipelineStage | null | undefined, minimumStage: CandidatePipelineStage) {
  if (!currentStage) return minimumStage;
  return stageRank(currentStage) >= stageRank(minimumStage) ? currentStage : minimumStage;
}

function resolveCandidateStatus(status: CandidateStatus | null | undefined, stage: CandidatePipelineStage) {
  if (stage === 'hired') return 'hired' as const;
  if (status === 'rejected') return 'rejected' as const;
  if (status === 'shortlisted') return 'shortlisted' as const;
  if (status === 'active') return 'active' as const;
  return 'pending' as const;
}

function selectMatchingJob(db: DatabaseSync, role: string) {
  const rows = db.prepare(
    `SELECT id, title, department, location, status, owner, posted_at, score_profile_id, job_description
     FROM jobs
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'on-hold' THEN 1 WHEN 'pending' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END, posted_at DESC, created_at DESC`
  ).all() as JobRow[];
  const normalizedRole = normalizeLookup(role);

  const exact = rows.find((row) => normalizeLookup(row.title) === normalizedRole);
  if (exact) return exact;

  const includesRole = rows.find((row) => normalizeLookup(row.title).includes(normalizedRole) || normalizedRole.includes(normalizeLookup(row.title)));
  return includesRole ?? null;
}

function ensureAssessmentJob(db: DatabaseSync, role: string, now: string) {
  const existing = selectMatchingJob(db, role);
  if (existing) return existing;

  const id = `job-auto-${slugify(role)}`;
  const department = inferDepartmentFromRole(role);
  const scoreProfileId = inferVacancyScoreProfile({ title: role, department });

  db.prepare(
    `INSERT INTO jobs (id, title, department, location, status, owner, posted_at, score_profile_id, job_description, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, '', ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       department = excluded.department,
       score_profile_id = excluded.score_profile_id,
       updated_at = excluded.updated_at`
  ).run(id, role, department, 'Por definir', 'Asignación automática', now, scoreProfileId, now, now);

  return db.prepare(
    `SELECT id, title, department, location, status, owner, posted_at, score_profile_id, job_description
     FROM jobs
     WHERE id = ?`
  ).get(id) as JobRow;
}

function getJobById(db: DatabaseSync, jobId: string) {
  return db.prepare(
    `SELECT id, title, department, location, status, owner, posted_at, score_profile_id, job_description
     FROM jobs
     WHERE id = ?`
  ).get(jobId) as JobRow | undefined;
}

function summarizeCandidateForJob(args: {
  job: JobRow;
  rawScores?: Record<string, number> | null;
  technicalScore?: number | null;
  cognitiveScore?: number | null;
  softSkillsScore?: number | null;
}) {
  const profileId = resolveJobScoreProfile({
    title: args.job.title,
    department: args.job.department,
    scoreProfileId: args.job.score_profile_id,
  });

  if (args.rawScores && Object.keys(args.rawScores).length > 0) {
    return buildAssessmentSummary(args.rawScores, profileId);
  }

  return buildAssessmentSummaryFromCategories(
    {
      technicalScore: args.technicalScore ?? null,
      cognitiveScore: args.cognitiveScore ?? null,
      softSkillsScore: args.softSkillsScore ?? null,
    },
    profileId
  );
}

function deriveVacancyRecommendation(args: {
  candidateId: string;
  name: string;
  email: string;
  job: JobRow;
  summary: ReturnType<typeof summarizeCandidateForJob>;
  status?: CandidateStatus | null;
  pipelineStage?: CandidatePipelineStage | null;
  shortlistManual?: boolean;
  source?: CandidateResult['source'];
  appliedAt?: string;
  updatedAt: string;
  location?: string;
  recruiter?: string;
  assessmentId?: string | null;
  strategyProfile?: string | null;
  personalityProfile?: string | null;
  rawScores?: Record<string, number> | null;
  hiredAt?: string | null;
  vacancyRecommendation?: VacancyRecommendation | null;
  vacancyRecommendationSource?: 'system' | 'manual' | null;
}): {
  recommendation: VacancyRecommendation;
  recommendationSource: 'system' | 'manual';
} {
  if (args.vacancyRecommendation) {
    return {
      recommendation: args.vacancyRecommendation,
      recommendationSource: args.vacancyRecommendationSource === 'manual' ? 'manual' : 'system',
    };
  }

  const recommendation = resolveVacancyRecommendation({
    id: args.candidateId,
    name: args.name,
    email: args.email,
    vacancyId: args.job.id,
    vacancy: args.job.title,
    department: args.job.department,
    totalScore: args.summary.totalScore,
    technicalScore: args.summary.technicalScore,
    cognitiveScore: args.summary.cognitiveScore,
    softSkillsScore: args.summary.softSkillsScore,
    fitScores: args.summary.fitScores,
    status: args.status ?? 'pending',
    pipelineStage: args.pipelineStage ?? 'assessment',
    appliedAt: args.appliedAt ?? args.updatedAt,
    updatedAt: args.updatedAt,
    location: args.location || args.job.location || 'Por definir',
    recruiter: args.recruiter || 'Administrador',
    source: args.source ?? 'assessment',
    assessmentId: args.assessmentId ?? undefined,
    strategyProfile: args.strategyProfile ?? undefined,
    personalityProfile: args.personalityProfile ?? undefined,
    rawScores: args.rawScores ?? undefined,
    hiredAt: args.hiredAt ?? undefined,
    scoreProfileId: args.summary.scoreProfileId,
    shortlistManual: Boolean(args.shortlistManual),
  });

  return {
    recommendation,
    recommendationSource: 'system',
  };
}

type ShortlistOrderRow = {
  id: string;
  shortlist_order: number | null;
  updated_at: string;
};

function getOrderedShortlistCandidateIds(db: DatabaseSync, vacancyId: string, excludeCandidateId?: string) {
  const rows = db.prepare(
    `SELECT id, shortlist_order, updated_at
     FROM candidates
     WHERE vacancy_id = ?
       AND shortlist_manual = 1
       ${excludeCandidateId ? 'AND id != ?' : ''}
     ORDER BY CASE WHEN shortlist_order IS NULL THEN 1 ELSE 0 END ASC, shortlist_order ASC, updated_at DESC`
  ).all(...(excludeCandidateId ? [vacancyId, excludeCandidateId] : [vacancyId])) as ShortlistOrderRow[];

  return rows.map((row) => row.id);
}

function applyShortlistOrdering(db: DatabaseSync, orderedCandidateIds: string[]) {
  if (!orderedCandidateIds.length) return;
  const update = db.prepare('UPDATE candidates SET shortlist_order = ? WHERE id = ?');
  orderedCandidateIds.forEach((candidateId, index) => {
    update.run(index + 1, candidateId);
  });
}

function syncCandidateFromAssessmentResult(db: DatabaseSync, input: AssessmentImportRecord, now: string) {
  const job = ensureAssessmentJob(db, input.role || 'Vacante sin definir', now);
  const summary = buildAssessmentSummary(
    input.scores,
    resolveJobScoreProfile({
      title: job.title,
      department: job.department,
      scoreProfileId: job.score_profile_id,
    })
  );
  const existing = db.prepare(
    `SELECT id, name, email, vacancy_id, vacancy, department, total_score, technical_score, cognitive_score, soft_skills_score,
           fit_scores, status, pipeline_stage, applied_at, updated_at, location, recruiter, source, assessment_id,
            strategy_profile, personality_profile, raw_scores, hired_at, score_profile_id, phone, recruiter_notes, shortlist_manual, shortlist_order,
            vacancy_recommendation, vacancy_recommendation_source
     FROM candidates
     WHERE assessment_id = ?
        OR (email = ? AND source = 'assessment' AND vacancy_id = ?)
     ORDER BY CASE WHEN assessment_id = ? THEN 0 ELSE 1 END, updated_at DESC
     LIMIT 1`
  ).get(input.id, input.candidateEmail, job.id, input.id) as CandidateRow | undefined;

  const nextPipelineStage = clampPipelineStage(existing?.pipeline_stage, 'assessment');
  const nextStatus = resolveCandidateStatus(existing?.status, nextPipelineStage);
  const candidateId = existing?.id ?? `candidate-${input.id}`;
  const recruiterName = existing?.recruiter || (db.prepare('SELECT owner_name FROM workspace_settings WHERE id = 1').get() as { owner_name: string }).owner_name;
  const location = existing?.location || job.location || 'Por definir';
  const appliedAt = existing?.applied_at || input.completedAt || now;
  const nextRecommendation = deriveVacancyRecommendation({
    candidateId,
    name: input.candidateName,
    email: input.candidateEmail,
    job,
    summary,
    status: nextStatus,
    pipelineStage: nextPipelineStage,
    shortlistManual: Boolean(existing?.shortlist_manual),
    source: 'assessment',
    appliedAt,
    updatedAt: now,
    location,
    recruiter: recruiterName,
    assessmentId: input.id,
    strategyProfile: input.strategyProfile ?? null,
    personalityProfile: input.personalityProfile ?? null,
    rawScores: input.scores,
    hiredAt: nextPipelineStage === 'hired' ? now : existing?.hired_at ?? null,
    vacancyRecommendation: existing?.vacancy_recommendation,
    vacancyRecommendationSource: existing?.vacancy_recommendation_source,
  });

  db.prepare(
    `INSERT INTO candidates (
      id, name, email, vacancy_id, vacancy, department, total_score, technical_score, cognitive_score, soft_skills_score,
      fit_scores, status, pipeline_stage, applied_at, updated_at, location, recruiter, source, assessment_id,
      strategy_profile, personality_profile, raw_scores, hired_at, score_profile_id, phone, recruiter_notes, shortlist_manual, shortlist_order,
      vacancy_recommendation, vacancy_recommendation_source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assessment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      vacancy_id = excluded.vacancy_id,
      vacancy = excluded.vacancy,
      department = excluded.department,
      total_score = excluded.total_score,
      technical_score = excluded.technical_score,
      cognitive_score = excluded.cognitive_score,
      soft_skills_score = excluded.soft_skills_score,
      fit_scores = excluded.fit_scores,
      updated_at = excluded.updated_at,
      location = excluded.location,
      recruiter = excluded.recruiter,
      source = 'assessment',
      assessment_id = excluded.assessment_id,
      strategy_profile = excluded.strategy_profile,
      personality_profile = excluded.personality_profile,
      raw_scores = excluded.raw_scores,
      score_profile_id = excluded.score_profile_id,
      phone = excluded.phone,
      recruiter_notes = excluded.recruiter_notes,
      shortlist_manual = excluded.shortlist_manual,
      shortlist_order = excluded.shortlist_order,
      vacancy_recommendation = excluded.vacancy_recommendation,
      vacancy_recommendation_source = excluded.vacancy_recommendation_source,
      pipeline_stage = ?,
      status = ?,
      hired_at = ?`
  ).run(
    candidateId,
    input.candidateName,
    input.candidateEmail,
    job.id,
    job.title,
    job.department,
    summary.totalScore,
    summary.technicalScore,
    summary.cognitiveScore,
    summary.softSkillsScore,
    JSON.stringify(summary.fitScores),
    nextStatus,
    nextPipelineStage,
    appliedAt,
    now,
    location,
    recruiterName,
    input.id,
    input.strategyProfile ?? null,
    input.personalityProfile ?? null,
    JSON.stringify(input.scores),
    nextPipelineStage === 'hired' ? now : existing?.hired_at ?? null,
    summary.scoreProfileId,
    existing?.phone ?? null,
    existing?.recruiter_notes ?? null,
    Boolean(existing?.shortlist_manual) ? 1 : 0,
    existing?.shortlist_order ?? null,
    nextRecommendation.recommendation,
    nextRecommendation.recommendationSource,
    existing ? existing.applied_at : now,
    nextPipelineStage,
    nextStatus,
    nextPipelineStage === 'hired' ? now : existing?.hired_at ?? null
  );

  db.prepare(
    `UPDATE assessment_results
     SET imported_candidate_id = ?, updated_at = ?
     WHERE id = ?`
  ).run(candidateId, now, input.id);

  return candidateId;
}

function mapJob(row: JobRow): JobOpening {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    location: row.location,
    status: row.status,
    owner: row.owner,
    postedAt: row.posted_at,
    scoreProfileId: row.score_profile_id,
    jobDescription: row.job_description ?? undefined,
  };
}

function mapCandidate(row: CandidateRow): CandidateResult {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    vacancyId: row.vacancy_id,
    vacancy: row.vacancy,
    department: row.department,
    totalScore: row.total_score,
    technicalScore: row.technical_score,
    cognitiveScore: row.cognitive_score,
    softSkillsScore: row.soft_skills_score,
    fitScores: safeParseJson<CandidateFitScores>(row.fit_scores),
    status: row.status,
    pipelineStage: row.pipeline_stage,
    appliedAt: row.applied_at,
    updatedAt: row.updated_at,
    location: row.location,
    recruiter: row.recruiter,
    source: row.source,
    assessmentId: row.assessment_id ?? undefined,
    strategyProfile: row.strategy_profile ?? undefined,
    personalityProfile: row.personality_profile ?? undefined,
    rawScores: safeParseJson<Record<string, number>>(row.raw_scores) ?? undefined,
    hiredAt: row.hired_at ?? undefined,
    scoreProfileId: (row.score_profile_id as VacancyScoreProfileId | null) ?? undefined,
    recruiterNotes: row.recruiter_notes ?? undefined,
    shortlistManual: Boolean(row.shortlist_manual),
    shortlistOrder: row.shortlist_order ?? undefined,
    vacancyRecommendation: row.vacancy_recommendation ?? undefined,
    vacancyRecommendationSource: row.vacancy_recommendation_source ?? undefined,
    aiMatchScore: row.ai_match_score ?? undefined,
    aiMatchReason: row.ai_match_reason ?? undefined,
  };
}

function mapInvite(row: InviteRow): AssessmentInvite {
  return {
    id: row.id,
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
    candidatePhone: row.candidate_phone ?? undefined,
    vacancyId: row.vacancy_id,
    vacancy: row.vacancy,
    department: row.department,
    recruiter: row.recruiter,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    status: row.status,
    assessmentUrl: `/?invite=${encodeURIComponent(row.id)}`,
  };
}

function mapAssessmentResult(row: AssessmentResultRow): AssessmentImportRecord {
  return {
    id: row.id,
    inviteId: row.invite_id,
    candidateName: row.candidate_name,
    candidateEmail: row.candidate_email,
    role: row.role,
    completedAt: row.completed_at,
    strategyProfile: row.strategy_profile ?? undefined,
    personalityProfile: row.personality_profile ?? undefined,
    scores: safeParseJson<Record<string, number>>(row.scores) || {},
    metrics: safeParseJson<Record<string, Record<string, number | string | boolean>>>(row.metrics) || {},
    totalScore: row.total_score,
    technicalScore: row.technical_score,
    cognitiveScore: row.cognitive_score,
    softSkillsScore: row.soft_skills_score,
    fitScores: safeParseJson<CandidateFitScores>(row.fit_scores) || {
      technicalMatch: row.technical_score,
      cognitivePerformance: row.cognitive_score,
      behavioralFit: row.soft_skills_score,
      communication: row.soft_skills_score,
      leadershipPotential: row.technical_score,
      cultureFit: row.soft_skills_score,
    },
    importedCandidateId: row.imported_candidate_id,
    scoreProfileId: (row.score_profile_id as VacancyScoreProfileId | null) ?? undefined,
  };
}

function mapRecruiterAuditSession(row: RecruiterAccessSessionRow): RecruiterAuditSession {
  return {
    sessionId: row.session_id,
    recruiterName: row.recruiter_name,
    recruiterEmail: row.recruiter_email,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lastSeenAt: row.last_seen_at,
    userAgent: row.last_user_agent,
  };
}

function mapRecruiterAuditEvent(row: RecruiterActivityEventRow): RecruiterAuditEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    recruiterName: row.recruiter_name,
    recruiterEmail: row.recruiter_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    details: row.details,
    occurredAt: row.occurred_at,
  };
}

export function getWorkspaceBundle(): AdminWorkspace {
  const db = getDb();
  const workspace = db.prepare('SELECT organization_name, owner_name, owner_role FROM workspace_settings WHERE id = 1').get() as WorkspaceRow;
  const jobs = db.prepare('SELECT id, title, department, location, status, owner, posted_at, score_profile_id, job_description FROM jobs ORDER BY posted_at DESC, created_at DESC').all() as JobRow[];
  const candidates = db.prepare(`
    SELECT id, name, email, vacancy_id, vacancy, department, total_score, technical_score, cognitive_score, soft_skills_score,
           fit_scores, status, pipeline_stage, applied_at, updated_at, location, recruiter, source, assessment_id,
           strategy_profile, personality_profile, raw_scores, hired_at, score_profile_id, phone, recruiter_notes, shortlist_manual, shortlist_order,
           vacancy_recommendation, vacancy_recommendation_source
    FROM candidates
    ORDER BY applied_at DESC, updated_at DESC
  `).all() as CandidateRow[];
  const invites = db.prepare(`
    SELECT id, candidate_name, candidate_email, candidate_phone, vacancy_id, vacancy, department, recruiter, expires_at, created_at, status
    FROM assessment_invites
    ORDER BY created_at DESC
  `).all() as InviteRow[];

  return {
    organizationName: workspace.organization_name,
    ownerName: workspace.owner_name,
    ownerRole: workspace.owner_role,
    jobs: jobs.map(mapJob),
    candidates: candidates.map(mapCandidate),
    invites: invites.map(mapInvite),
  };
}

export function getAssessmentResults() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, invite_id, candidate_name, candidate_email, role, completed_at, strategy_profile, personality_profile,
           scores, metrics, total_score, technical_score, cognitive_score, soft_skills_score, fit_scores,
           imported_candidate_id, score_profile_id
    FROM assessment_results
    ORDER BY completed_at DESC, created_at DESC
  `).all() as AssessmentResultRow[];

  return rows.map(mapAssessmentResult);
}

export function upsertAssessmentResult(input: AssessmentImportRecord) {
  const db = getDb();
  const now = new Date().toISOString();

  const invite = input.inviteId?.trim()
    ? (db.prepare(
        `SELECT id, candidate_name, candidate_email, candidate_phone, vacancy_id, vacancy, department, recruiter, expires_at, created_at, status
         FROM assessment_invites
         WHERE id = ?
         LIMIT 1`
      ).get(input.inviteId.trim()) as InviteRow | undefined)
    : undefined;

  if (input.inviteId && !invite) {
    throw new Error('Assessment invite not found');
  }

  if (invite) {
    if (invite.status === 'cancelled' || invite.status === 'expired') {
      throw new Error('Assessment invite is no longer active');
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      db.prepare(
        `UPDATE assessment_invites
         SET status = 'expired', updated_at = ?
         WHERE id = ?`
      ).run(now, invite.id);
      throw new Error('Assessment invite expired');
    }
    if (normalizeLookup(invite.candidate_email) !== normalizeLookup(input.candidateEmail)) {
      throw new Error('Assessment invite email does not match candidate email');
    }
  }

  const invitedJob = invite ? getJobById(db, invite.vacancy_id) : undefined;
  // Try to match an EXISTING job only — never auto-create one for public results.
  const matchedJob = invitedJob ?? (input.role ? selectMatchingJob(db, input.role) : null);
  const resolvedRole = invite?.vacancy || matchedJob?.title || input.role || '';

  const summary = matchedJob
    ? buildAssessmentSummary(
        input.scores,
        resolveJobScoreProfile({
          title: matchedJob.title,
          department: matchedJob.department,
          scoreProfileId: matchedJob.score_profile_id,
        })
      )
    : buildAssessmentSummary(input.scores);

  db.prepare(
    `INSERT INTO assessment_results (
      id, invite_id, candidate_name, candidate_email, role, completed_at, strategy_profile, personality_profile,
      scores, metrics, total_score, technical_score, cognitive_score, soft_skills_score, fit_scores,
      imported_candidate_id, score_profile_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      invite_id = COALESCE(excluded.invite_id, assessment_results.invite_id),
      candidate_name = excluded.candidate_name,
      candidate_email = excluded.candidate_email,
      role = excluded.role,
      completed_at = excluded.completed_at,
      strategy_profile = excluded.strategy_profile,
      personality_profile = excluded.personality_profile,
      scores = excluded.scores,
      metrics = excluded.metrics,
      total_score = excluded.total_score,
      technical_score = excluded.technical_score,
      cognitive_score = excluded.cognitive_score,
      soft_skills_score = excluded.soft_skills_score,
      fit_scores = excluded.fit_scores,
      score_profile_id = excluded.score_profile_id,
      updated_at = excluded.updated_at`
  ).run(
    input.id,
    invite?.id ?? input.inviteId ?? null,
    input.candidateName,
    input.candidateEmail,
    resolvedRole,
    input.completedAt,
    input.strategyProfile ?? null,
    input.personalityProfile ?? null,
    JSON.stringify(input.scores),
    JSON.stringify(input.metrics),
    summary.totalScore,
    summary.technicalScore,
    summary.cognitiveScore,
    summary.softSkillsScore,
    JSON.stringify(summary.fitScores),
    input.importedCandidateId ?? null,
    summary.scoreProfileId,
    now,
    now
  );

  // Only auto-sync candidate if there's an existing matching job
  if (matchedJob) {
    syncCandidateFromAssessmentResult(
      db,
      {
        ...input,
        inviteId: invite?.id ?? input.inviteId,
        role: resolvedRole,
        totalScore: summary.totalScore,
        technicalScore: summary.technicalScore,
        cognitiveScore: summary.cognitiveScore,
        softSkillsScore: summary.softSkillsScore,
        fitScores: summary.fitScores,
        scoreProfileId: summary.scoreProfileId,
      },
      now
    );
  }

  if (invite) {
    db.prepare(
      `UPDATE assessment_invites
       SET status = 'completed', updated_at = ?
       WHERE id = ?`
    ).run(now, invite.id);
  }

  return getAssessmentResults();
}

export function getAssessmentInviteById(inviteId: string) {
  const db = getDb();
  const invite = db.prepare(
    `SELECT id, candidate_name, candidate_email, candidate_phone, vacancy_id, vacancy, department, recruiter, expires_at, created_at, status
     FROM assessment_invites
     WHERE id = ?
     LIMIT 1`
  ).get(inviteId) as InviteRow | undefined;

  if (!invite) return null;
  if (invite.status !== 'sent') return mapInvite(invite);

  const now = new Date().toISOString();
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    db.prepare(
      `UPDATE assessment_invites
       SET status = 'expired', updated_at = ?
       WHERE id = ?`
    ).run(now, invite.id);
    return mapInvite({ ...invite, status: 'expired' });
  }

  return mapInvite(invite);
}

export function updateWorkspaceSettings(input: Pick<AdminWorkspace, 'organizationName' | 'ownerName' | 'ownerRole'>) {
  const db = getDb();
  db.prepare(
    `UPDATE workspace_settings
     SET organization_name = ?, owner_name = ?, owner_role = ?, updated_at = ?
     WHERE id = 1`
  ).run(input.organizationName, input.ownerName, input.ownerRole, new Date().toISOString());
  return getWorkspaceBundle();
}

export function createJob(
  input: Pick<JobOpening, 'title' | 'department' | 'location'> & {
    owner?: string;
    status?: JobOpening['status'];
    scoreProfileId?: VacancyScoreProfileId;
    jobDescription?: string;
  }
) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `job-${crypto.randomUUID()}`;
  const scoreProfileId = input.scoreProfileId ?? inferVacancyScoreProfile({ title: input.title, department: input.department });
  db.prepare(
    `INSERT INTO jobs (id, title, department, location, status, owner, posted_at, score_profile_id, job_description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title,
    input.department,
    input.location,
    input.status ?? 'active',
    input.owner ?? 'Administrador',
    now,
    scoreProfileId,
    input.jobDescription?.trim() ?? '',
    now,
    now
  );
  return getWorkspaceBundle();
}

export function updateJob(input: {
  id: string;
  title?: string;
  department?: string;
  location?: string;
  owner?: string;
  status?: JobOpening['status'];
  scoreProfileId?: VacancyScoreProfileId;
  jobDescription?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getJobById(db, input.id);

  if (!existing) {
    throw new Error('Job not found');
  }

  db.prepare(
    `UPDATE jobs
     SET title = ?,
         department = ?,
         location = ?,
         status = ?,
         owner = ?,
         score_profile_id = ?,
         job_description = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    input.title?.trim() || existing.title,
    input.department?.trim() || existing.department,
    input.location?.trim() || existing.location,
    input.status ?? existing.status,
    input.owner?.trim() || existing.owner,
    input.scoreProfileId ?? existing.score_profile_id,
    typeof input.jobDescription === 'string' ? input.jobDescription.trim() : existing.job_description ?? '',
    now,
    input.id
  );

  return getWorkspaceBundle();
}

export function createCandidate(input: CandidateResult) {
  const db = getDb();
  const now = new Date().toISOString();
  const job = getJobById(db, input.vacancyId);
  const summary = job
    ? summarizeCandidateForJob({
        job,
        rawScores: input.rawScores,
        technicalScore: input.technicalScore,
        cognitiveScore: input.cognitiveScore,
        softSkillsScore: input.softSkillsScore,
      })
    : buildAssessmentSummaryFromCategories(
        {
          technicalScore: input.technicalScore,
          cognitiveScore: input.cognitiveScore,
          softSkillsScore: input.softSkillsScore,
        },
        input.scoreProfileId ?? 'generalist'
      );

  const vacancyTitle = job?.title ?? input.vacancy;
  const vacancyDepartment = job?.department ?? input.department;
  const location = input.location || job?.location || 'Sin ubicación';
  const recommendation = deriveVacancyRecommendation({
    candidateId: input.id,
    name: input.name,
    email: input.email,
    job: job ?? {
      id: input.vacancyId,
      title: vacancyTitle,
      department: vacancyDepartment,
      location,
      status: 'pending',
      owner: input.recruiter || 'Administrador',
      posted_at: input.appliedAt || now,
      score_profile_id: summary.scoreProfileId,
      job_description: '',
    },
    summary,
    status: input.status,
    pipelineStage: input.pipelineStage,
    shortlistManual: Boolean(input.shortlistManual),
    source: input.source,
    appliedAt: input.appliedAt,
    updatedAt: input.updatedAt || now,
    location,
    recruiter: input.recruiter,
    assessmentId: input.assessmentId ?? null,
    strategyProfile: input.strategyProfile ?? null,
    personalityProfile: input.personalityProfile ?? null,
    rawScores: input.rawScores ?? null,
    hiredAt: input.hiredAt ?? null,
    vacancyRecommendation: input.vacancyRecommendation ?? null,
    vacancyRecommendationSource: input.vacancyRecommendationSource ?? null,
  });

  db.prepare(
    `INSERT INTO candidates (
      id, name, email, vacancy_id, vacancy, department, total_score, technical_score, cognitive_score, soft_skills_score,
      fit_scores, status, pipeline_stage, applied_at, updated_at, location, recruiter, source, assessment_id,
      strategy_profile, personality_profile, raw_scores, hired_at, score_profile_id, phone, recruiter_notes, shortlist_manual, shortlist_order,
      vacancy_recommendation, vacancy_recommendation_source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.email,
    input.vacancyId,
    vacancyTitle,
    vacancyDepartment,
    summary.totalScore,
    summary.technicalScore,
    summary.cognitiveScore,
    summary.softSkillsScore,
    summary.fitScores ? JSON.stringify(summary.fitScores) : null,
    input.status,
    input.pipelineStage,
    input.appliedAt,
    input.updatedAt || now,
    location,
    input.recruiter,
    input.source,
    input.assessmentId ?? null,
    input.strategyProfile ?? null,
    input.personalityProfile ?? null,
    input.rawScores ? JSON.stringify(input.rawScores) : null,
    input.hiredAt ?? null,
    summary.scoreProfileId,
    input.phone?.trim() || null,
    input.recruiterNotes?.trim() || null,
    input.shortlistManual ? 1 : 0,
    input.shortlistManual ? (input.shortlistOrder ?? getOrderedShortlistCandidateIds(db, input.vacancyId).length + 1) : null,
    recommendation.recommendation,
    input.vacancyRecommendationSource === 'manual' ? 'manual' : recommendation.recommendationSource,
    now
  );
  if (input.shortlistManual) {
    applyShortlistOrdering(db, getOrderedShortlistCandidateIds(db, input.vacancyId));
  }
  if (input.assessmentId) {
    db.prepare(
      `UPDATE assessment_results
       SET imported_candidate_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(input.id, now, input.assessmentId);
  }
  return getWorkspaceBundle();
}

export function updateCandidateProgress(input: {
  id: string;
  status: CandidateStatus;
  pipelineStage: CandidatePipelineStage;
  vacancyId?: string;
  phone?: string;
  recruiterNotes?: string;
  shortlistManual?: boolean;
  shortlistOrder?: number;
  vacancyRecommendation?: VacancyRecommendation;
  vacancyRecommendationSource?: 'system' | 'manual';
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare(
    `SELECT id, name, email, vacancy_id, vacancy, department, total_score, technical_score, cognitive_score, soft_skills_score,
            fit_scores, status, pipeline_stage, applied_at, updated_at, location, recruiter, source, assessment_id,
            strategy_profile, personality_profile, raw_scores, hired_at, score_profile_id, phone, recruiter_notes, shortlist_manual, shortlist_order,
            vacancy_recommendation, vacancy_recommendation_source
     FROM candidates
     WHERE id = ?`
  ).get(input.id) as CandidateRow | undefined;

  if (!existing) {
    throw new Error('Candidate not found');
  }

  const nextJob = input.vacancyId && input.vacancyId !== existing.vacancy_id ? getJobById(db, input.vacancyId) : undefined;
  const vacancyId = nextJob?.id ?? existing.vacancy_id;
  const vacancyTitle = nextJob?.title ?? existing.vacancy;
  const vacancyDepartment = nextJob?.department ?? existing.department;
  const nextLocation = existing.location || nextJob?.location || 'Sin ubicación';
  const nextStatus = resolveCandidateStatus(input.status, input.pipelineStage);
  const recommendationSummary = summarizeCandidateForJob({
    job: nextJob ?? {
      id: existing.vacancy_id,
      title: existing.vacancy,
      department: existing.department,
      location: nextLocation,
      status: 'pending',
      owner: existing.recruiter,
      posted_at: existing.applied_at,
      score_profile_id: (existing.score_profile_id as VacancyScoreProfileId | null) ?? 'generalist',
      job_description: '',
    },
    rawScores: safeParseJson<Record<string, number>>(existing.raw_scores),
    technicalScore: existing.technical_score,
    cognitiveScore: existing.cognitive_score,
    softSkillsScore: existing.soft_skills_score,
  });
  const requestedShortlistOrder =
    typeof input.shortlistOrder === 'number' && Number.isFinite(input.shortlistOrder)
      ? Math.max(1, Math.round(input.shortlistOrder))
      : undefined;
  const nextShortlistManual =
    requestedShortlistOrder != null
      ? true
      : typeof input.shortlistManual === 'boolean'
        ? input.shortlistManual
        : Boolean(existing.shortlist_manual);
  const derivedRecommendation = deriveVacancyRecommendation({
    candidateId: existing.id,
    name: existing.name,
    email: existing.email,
    job: nextJob ?? {
      id: existing.vacancy_id,
      title: existing.vacancy,
      department: existing.department,
      location: nextLocation,
      status: 'pending',
      owner: existing.recruiter,
      posted_at: existing.applied_at,
      score_profile_id: recommendationSummary.scoreProfileId,
      job_description: '',
    },
    summary: recommendationSummary,
    status: nextStatus,
    pipelineStage: input.pipelineStage,
    shortlistManual: nextShortlistManual,
    source: existing.source,
    appliedAt: existing.applied_at,
    updatedAt: now,
    location: nextLocation,
    recruiter: existing.recruiter,
    assessmentId: existing.assessment_id,
    strategyProfile: existing.strategy_profile,
    personalityProfile: existing.personality_profile,
    rawScores: safeParseJson<Record<string, number>>(existing.raw_scores),
    hiredAt: existing.hired_at,
    vacancyRecommendation: input.vacancyRecommendation ?? null,
    vacancyRecommendationSource: input.vacancyRecommendation ? 'manual' : undefined,
  });
  const nextRecommendation = derivedRecommendation.recommendation;
  const recommendationSource =
    input.vacancyRecommendation != null || input.vacancyRecommendationSource === 'manual'
      ? 'manual'
      : (existing.vacancy_recommendation_source ?? derivedRecommendation.recommendationSource);
  const remainingShortlistIds = getOrderedShortlistCandidateIds(db, vacancyId, input.id);
  const preservedIndex =
    Boolean(existing.shortlist_manual) && typeof existing.shortlist_order === 'number' && existing.shortlist_order > 0
      ? Math.min(existing.shortlist_order - 1, remainingShortlistIds.length)
      : remainingShortlistIds.length;
  const targetIndex =
    requestedShortlistOrder != null
      ? Math.min(requestedShortlistOrder - 1, remainingShortlistIds.length)
      : preservedIndex;
  const nextShortlistOrder = nextShortlistManual ? targetIndex + 1 : null;
  const orderedShortlistIds = [...remainingShortlistIds];

  if (nextShortlistManual) {
    orderedShortlistIds.splice(targetIndex, 0, input.id);
  }

  db.prepare(
    `UPDATE candidates
     SET status = ?,
         pipeline_stage = ?,
         vacancy_id = ?,
         vacancy = ?,
         department = ?,
         score_profile_id = ?,
         phone = ?,
         recruiter_notes = ?,
         shortlist_manual = ?,
         shortlist_order = ?,
         vacancy_recommendation = ?,
         vacancy_recommendation_source = ?,
         hired_at = CASE
           WHEN ? = 'hired' OR ? = 'hired' THEN COALESCE(hired_at, ?)
           ELSE NULL
         END,
         updated_at = ?
     WHERE id = ?`
  ).run(
    nextStatus,
    input.pipelineStage,
    vacancyId,
    vacancyTitle,
    vacancyDepartment,
    recommendationSummary.scoreProfileId,
    typeof input.phone === 'string' ? input.phone.trim() || null : existing.phone,
    typeof input.recruiterNotes === 'string' ? input.recruiterNotes.trim() || null : existing.recruiter_notes,
    nextShortlistManual ? 1 : 0,
    nextShortlistOrder,
    nextRecommendation,
    recommendationSource,
    nextStatus,
    input.pipelineStage,
    now,
    now,
    input.id
  );

  applyShortlistOrdering(db, orderedShortlistIds);

  return getWorkspaceBundle();
}

export function createInvite(input: AssessmentInvite) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO assessment_invites (
      id, candidate_name, candidate_email, candidate_phone, vacancy_id, vacancy, department, recruiter, expires_at, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.candidateName,
    input.candidateEmail,
    input.candidatePhone?.trim() || null,
    input.vacancyId,
    input.vacancy,
    input.department,
    input.recruiter,
    input.expiresAt,
    input.status,
    now,
    now
  );
  return getWorkspaceBundle();
}

export function startRecruiterAccessSession(input: {
  sessionId?: string;
  name: string;
  email: string;
  userAgent?: string | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  const sessionId = input.sessionId?.trim() || `recruiter-${crypto.randomUUID()}`;

  db.prepare(
    `INSERT INTO recruiter_access_sessions (
      session_id, recruiter_name, recruiter_email, status, started_at, ended_at, last_seen_at, last_user_agent, created_at, updated_at
    ) VALUES (?, ?, ?, 'active', ?, NULL, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      recruiter_name = excluded.recruiter_name,
      recruiter_email = excluded.recruiter_email,
      status = 'active',
      ended_at = NULL,
      last_seen_at = excluded.last_seen_at,
      last_user_agent = excluded.last_user_agent,
      updated_at = excluded.updated_at`
  ).run(sessionId, input.name, input.email, now, now, input.userAgent ?? null, now, now);

  db.prepare(
    `INSERT INTO recruiter_access_events (
      id, session_id, recruiter_name, recruiter_email, action, occurred_at, user_agent, created_at
    ) VALUES (?, ?, ?, ?, 'login', ?, ?, ?)`
  ).run(`event-${crypto.randomUUID()}`, sessionId, input.name, input.email, now, input.userAgent ?? null, now);

  const session = db.prepare(
    `SELECT session_id, recruiter_name, recruiter_email, status, started_at, ended_at, last_seen_at, last_user_agent
     FROM recruiter_access_sessions
     WHERE session_id = ?`
  ).get(sessionId) as RecruiterAccessSessionRow;

  return {
    sessionId: session.session_id,
    name: session.recruiter_name,
    email: session.recruiter_email,
    createdAt: Date.parse(session.started_at) || Date.now(),
    persistedAt: session.started_at,
  };
}

export function endRecruiterAccessSession(input: {
  sessionId: string;
  name: string;
  email: string;
  userAgent?: string | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE recruiter_access_sessions
     SET recruiter_name = ?, recruiter_email = ?, status = 'closed', ended_at = ?, last_seen_at = ?, last_user_agent = ?, updated_at = ?
     WHERE session_id = ?`
  ).run(input.name, input.email, now, now, input.userAgent ?? null, now, input.sessionId);

  db.prepare(
    `INSERT INTO recruiter_access_events (
      id, session_id, recruiter_name, recruiter_email, action, occurred_at, user_agent, created_at
    ) VALUES (?, ?, ?, ?, 'logout', ?, ?, ?)`
  ).run(`event-${crypto.randomUUID()}`, input.sessionId, input.name, input.email, now, input.userAgent ?? null, now);

  return { ok: true as const };
}

export function isRecruiterSessionActive(sessionId: string, email?: string | null) {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) return false;

  const row = getDb()
    .prepare(
      `SELECT session_id, recruiter_email, status
       FROM recruiter_access_sessions
       WHERE session_id = ?
       LIMIT 1`
    )
    .get(normalizedSessionId) as { recruiter_email: string; status: string } | undefined;

  if (!row || row.status !== 'active') return false;
  if (email?.trim() && row.recruiter_email.toLowerCase() !== email.trim().toLowerCase()) return false;
  return true;
}

export function recordRecruiterActivityEvent(input: {
  sessionId: string;
  recruiterName: string;
  recruiterEmail: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  details?: string | null;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO recruiter_activity_events (
      id, session_id, recruiter_name, recruiter_email, action, entity_type, entity_id, summary, details, occurred_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `activity-${crypto.randomUUID()}`,
    input.sessionId,
    input.recruiterName,
    input.recruiterEmail,
    input.action,
    input.entityType ?? null,
    input.entityId ?? null,
    input.summary,
    input.details ?? null,
    now,
    now
  );

  db.prepare(
    `UPDATE recruiter_access_sessions
     SET last_seen_at = ?, updated_at = ?
     WHERE session_id = ?`
  ).run(now, now, input.sessionId);

  return { ok: true as const };
}

export function getRecruiterAuditBundle(): RecruiterAuditBundle {
  const db = getDb();
  const activeSessions = db.prepare(
    `SELECT session_id, recruiter_name, recruiter_email, status, started_at, ended_at, last_seen_at, last_user_agent
     FROM recruiter_access_sessions
     WHERE status = 'active'
     ORDER BY started_at DESC
     LIMIT 10`
  ).all() as RecruiterAccessSessionRow[];

  const recentAccesses = db.prepare(
    `SELECT session_id, recruiter_name, recruiter_email, status, started_at, ended_at, last_seen_at, last_user_agent
     FROM recruiter_access_sessions
     ORDER BY started_at DESC
     LIMIT 12`
  ).all() as RecruiterAccessSessionRow[];

  const recentClosures = db.prepare(
    `SELECT session_id, recruiter_name, recruiter_email, status, started_at, ended_at, last_seen_at, last_user_agent
     FROM recruiter_access_sessions
     WHERE ended_at IS NOT NULL
     ORDER BY ended_at DESC
     LIMIT 12`
  ).all() as RecruiterAccessSessionRow[];

  const recentEvents = db.prepare(
    `SELECT id, session_id, recruiter_name, recruiter_email, action, entity_type, entity_id, summary, details, occurred_at
     FROM recruiter_activity_events
     ORDER BY occurred_at DESC, created_at DESC
     LIMIT 25`
  ).all() as RecruiterActivityEventRow[];

  return {
    activeSessions: activeSessions.map(mapRecruiterAuditSession),
    recentAccesses: recentAccesses.map(mapRecruiterAuditSession),
    recentClosures: recentClosures.map(mapRecruiterAuditSession),
    recentEvents: recentEvents.map(mapRecruiterAuditEvent),
  };
}

export function updateCandidateAIMatch(candidateId: string, aiMatchScore: number, aiMatchReason: string) {
  const db = getDb();
  db.prepare(
    `UPDATE candidates
     SET ai_match_score = ?, ai_match_reason = ?, updated_at = ?
     WHERE id = ?`
  ).run(aiMatchScore, aiMatchReason, new Date().toISOString(), candidateId);

  return { success: true };
}
