'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  Download,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Save,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ActiveJobsTable } from '@/components/admin-dashboard/active-jobs-table';
import { AddCandidateModal, type AddCandidatePayload } from '@/components/admin-dashboard/add-candidate-modal';
import { AdminSidebar } from '@/components/admin-dashboard/admin-sidebar';
import { AlertsPanel } from '@/components/admin-dashboard/alerts-panel';
import { CandidateDetailModal } from '@/components/admin-dashboard/candidate-detail-modal';
import { CandidateResultsTable } from '@/components/admin-dashboard/candidate-results-table';
import { CreateVacancyModal } from '@/components/admin-dashboard/create-vacancy-modal';
import { DashboardHeader } from '@/components/admin-dashboard/dashboard-header';
import { FitScoreWidget } from '@/components/admin-dashboard/fit-score-widget';
import { ImportAssessmentsModal } from '@/components/admin-dashboard/import-assessments-modal';
import { KpiCard } from '@/components/admin-dashboard/kpi-card';
import { PipelineChart } from '@/components/admin-dashboard/pipeline-chart';
import { ScheduleInterviewModal, type ScheduleInterviewPayload } from '@/components/admin-dashboard/schedule-interview-modal';
import { UpcomingInterviews } from '@/components/admin-dashboard/upcoming-interviews';
import { WorkspaceOnboarding } from '@/components/admin-dashboard/workspace-onboarding';
import {
  createAdminCandidate,
  createAdminInterview,
  createAdminJob,
  endRecruiterAccess,
  fetchRecruiterAudit,
  fetchAdminAssessmentResults,
  fetchAdminWorkspace,
  recordRecruiterActivity,
  saveAdminWorkspaceSettings,
  updateAdminCandidate,
} from '@/lib/admin-dashboard/api';
import {
  clearRecruiterAccessSession,
  readRecruiterAccessSession,
  type RecruiterAccessSession,
} from '@/lib/admin-dashboard/recruiter-session';
import { adminNavItems } from '@/lib/admin-dashboard/mock-data';
import {
  buildCandidateDecision,
  getRecruiterDecisionMeta,
  getVacancyRecommendationMeta,
  sortCandidatesForDecision,
} from '@/lib/admin-dashboard/recruiter-decisioning';
import {
  buildCandidateFromAssessment,
  buildManualCandidateSummaryForJob,
  createEmptyWorkspace,
  normalizeCandidateStatus,
} from '@/lib/admin-dashboard/storage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  AdminView,
  AdminWorkspace,
  AlertItem,
  AssessmentImportRecord,
  CandidateFitScores,
  CandidatePipelineStage,
  CandidateResult,
  CandidateStatus,
  FilterOption,
  FitScoreCategory,
  JobOpening,
  JobOpeningWithStats,
  KpiMetric,
  NavItem,
  PipelineStage,
  RecruiterAuditBundle,
  RecruiterAuditEvent,
  RecruiterAuditSession,
  ReportCard,
  UpcomingInterview,
  VacancyRecommendation,
  VacancyScoreProfileId,
} from '@/types/admin-dashboard';

const VIEW_META: Record<AdminView, { title: string; description: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Vista general del workspace, con métricas reales y sincronización assessment → pipeline.',
  },
  candidates: {
    title: 'Candidatos',
    description: 'Perfiles cargados por el equipo o sincronizados automáticamente desde el assessment.',
  },
  jobs: {
    title: 'Vacantes',
    description: 'Roles activos, drafts y su volumen real de candidatos por etapa.',
  },
  pipeline: {
    title: 'Pipeline',
    description: 'Conversión del funnel calculada a partir del estado actual de los candidatos.',
  },
  interviews: {
    title: 'Entrevistas',
    description: 'Agenda del equipo y próximos hitos del proceso.',
  },
  assessments: {
    title: 'Evaluaciones',
    description: 'Scores y breakdown de candidatos que ya tienen resultados cargados.',
  },
  audit: {
    title: 'Auditoría',
    description: 'Últimos accesos recruiter, sesiones activas y trazabilidad operativa del workspace.',
  },
  reports: {
    title: 'Reportes',
    description: 'Indicadores consolidados derivados del workspace actual.',
  },
  settings: {
    title: 'Configuración',
    description: 'Workspace persistido en SQLite vía API interna, con trazabilidad recruiter.',
  },
};

const PIPELINE_STAGE_META: Array<{ id: CandidatePipelineStage; label: string; color: string }> = [
  { id: 'applied', label: 'Aplicado', color: '#0f766e' },
  { id: 'screening', label: 'Filtro inicial', color: '#0891b2' },
  { id: 'assessment', label: 'Evaluación', color: '#2563eb' },
  { id: 'interview', label: 'Entrevista', color: '#0ea5e9' },
  { id: 'final-review', label: 'Revisión final', color: '#14b8a6' },
  { id: 'hired', label: 'Contratado', color: '#10b981' },
];

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageNullable(values: Array<number | null | undefined>) {
  const numeric = values.filter((value): value is number => typeof value === 'number');
  if (!numeric.length) return null;
  return average(numeric);
}

function buildFilterOptions(jobs: JobOpening[]): FilterOption[] {
  const departments = Array.from(new Set(jobs.map((job) => job.department))).sort((a, b) => a.localeCompare(b));

  return [
    { value: 'all', label: 'Todas las vacantes y áreas', kind: 'all' },
    ...departments.map((department) => ({
      value: `department:${department}`,
      label: department,
      kind: 'department' as const,
    })),
    ...jobs.map((job) => ({
      value: `job:${job.id}`,
      label: job.title,
      kind: 'job' as const,
    })),
  ];
}

function matchesSearch(query: string, values: string[]) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => value.toLowerCase().includes(normalized));
}

function matchesScope(filterValue: string, item: { department: string; vacancyId?: string; id?: string }) {
  if (filterValue === 'all') return true;
  if (filterValue.startsWith('department:')) {
    return item.department === filterValue.replace('department:', '');
  }
  if (filterValue.startsWith('job:')) {
    const jobId = filterValue.replace('job:', '');
    return item.vacancyId === jobId || item.id === jobId;
  }
  return true;
}

function calculateDelta(currentValue: number, previousValue: number) {
  if (previousValue === 0) return currentValue === 0 ? 0 : null;
  return Math.round(((currentValue - previousValue) / previousValue) * 1000) / 10;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function countByPeriod(values: string[]) {
  const currentStart = daysAgo(30);
  const previousStart = daysAgo(60);
  const current = values.filter((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= currentStart;
  }).length;
  const previous = values.filter((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= previousStart && date < currentStart;
  }).length;
  return { current, previous };
}

function computeAverageForPeriod(records: Array<{ value: number; date: string }>) {
  const currentStart = daysAgo(30);
  const previousStart = daysAgo(60);
  const currentValues = records.filter((record) => {
    const date = new Date(record.date);
    return !Number.isNaN(date.getTime()) && date >= currentStart;
  });
  const previousValues = records.filter((record) => {
    const date = new Date(record.date);
    return !Number.isNaN(date.getTime()) && date >= previousStart && date < currentStart;
  });
  return {
    current: currentValues.length ? average(currentValues.map((record) => record.value)) : null,
    previous: previousValues.length ? average(previousValues.map((record) => record.value)) : null,
  };
}

function buildNavItems({
  candidates,
  jobs,
  interviews,
}: {
  candidates: CandidateResult[];
  jobs: JobOpening[];
  interviews: UpcomingInterview[];
}): NavItem[] {
  return adminNavItems.map((item) => {
    if (item.key === 'candidates') return { ...item, badge: candidates.length };
    if (item.key === 'jobs') return { ...item, badge: jobs.filter((job) => job.status === 'active').length };
    if (item.key === 'interviews') return { ...item, badge: interviews.filter((interview) => interview.status === 'pending').length };
    if (item.key === 'assessments') return { ...item, badge: candidates.filter((candidate) => candidate.totalScore != null).length };
    return item;
  });
}

function ViewIntro({ view }: { view: AdminView }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{VIEW_META[view].title}</h2>
        <Badge variant="outline">SQLite workspace</Badge>
      </div>
      <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{VIEW_META[view].description}</p>
    </div>
  );
}

function SmallStatCard({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</div>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{hint}</p>
        </div>
        <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-600 dark:text-cyan-300">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionStatCard({
  title,
  value,
  hint,
  decision,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  decision: 'advance' | 'review' | 'decline';
  icon: LucideIcon;
}) {
  const meta = getRecruiterDecisionMeta(decision);
  return (
    <Card className={`border ${meta.surfaceClass}`}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] opacity-70">{hint}</p>
        </div>
        <div className="rounded-2xl border border-current/15 bg-white/70 p-3">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionQueueCard({
  candidates,
  onViewCandidate,
  onShortlistCandidate,
  onToggleShortlistCandidate,
}: {
  candidates: CandidateResult[];
  onViewCandidate: (candidate: CandidateResult) => void;
  onShortlistCandidate: (candidate: CandidateResult) => void;
  onToggleShortlistCandidate: (candidate: CandidateResult) => void;
}) {
  if (!candidates.length) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Mesa de decisión</CardTitle>
            <CardDescription>No hay suficientes resultados visibles para priorizar candidatos.</CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Mesa de decisión</CardTitle>
          <CardDescription>Prioriza primero a quienes ya muestran señales suficientes para pasar al siguiente paso.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {candidates.map((candidate) => {
          const decision = buildCandidateDecision(candidate);
          const meta = getRecruiterDecisionMeta(decision.decision);
          const recommendationMeta = getVacancyRecommendationMeta(decision.recommendation);
          const isShortlisted = Boolean(candidate.shortlistManual);
          return (
            <div key={candidate.id} className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-950">{candidate.name}</p>
                    <Badge className={meta.badgeClass}>{decision.shortLabel}</Badge>
                    <Badge className={recommendationMeta.badgeClass}>{recommendationMeta.shortLabel}</Badge>
                    {isShortlisted ? <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">Shortlist</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{candidate.vacancy} · Readiness {decision.readinessScore}/100</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={isShortlisted ? 'outline' : 'default'}
                    className={isShortlisted ? 'border-slate-200 text-slate-700' : 'bg-cyan-600 text-white hover:bg-cyan-500'}
                    onClick={() => onToggleShortlistCandidate(candidate)}
                  >
                    {isShortlisted ? 'Quitar shortlist' : 'Guardar shortlist'}
                  </Button>
                  {decision.shortlistEligible && !isShortlisted ? (
                    <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => onShortlistCandidate(candidate)}>
                      Priorizar ahora
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{decision.rationale}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-900">
                  <span className="font-semibold">Fortaleza guía:</span>{' '}
                  {decision.strengths[0] || 'No aparece una fortaleza dominante todavía.'}
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-sm text-amber-900">
                  <span className="font-semibold">Riesgo principal:</span>{' '}
                  {decision.risks[0] || 'No surge un riesgo crítico en esta lectura.'}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" className="text-cyan-700 hover:bg-cyan-50" onClick={() => onViewCandidate(candidate)}>
                  Ver ficha táctica
                </Button>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                  {decision.nextStep}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CandidateComparisonCard({
  candidates,
  onViewCandidate,
  onToggleShortlistCandidate,
}: {
  candidates: CandidateResult[];
  onViewCandidate: (candidate: CandidateResult) => void;
  onToggleShortlistCandidate: (candidate: CandidateResult) => void;
}) {
  if (!candidates.length) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Comparación rápida</CardTitle>
            <CardDescription>Hace falta al menos un candidato con score visible para comparar.</CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Comparación rápida</CardTitle>
          <CardDescription>Comparación side-by-side de los perfiles más fuertes del filtro actual para decidir a quién mover primero.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[220px_repeat(3,minmax(220px,1fr))] gap-3">
            <div className="space-y-3">
              <div className="rounded-2xl border border-transparent bg-transparent p-4" />
              {[
                'Score total',
                'Decisión recruiter',
                'Recomendación vacante',
                'Shortlist manual',
                'Score técnico',
                'Score cognitivo',
                'Soft skills',
                'Fortaleza guía',
                'Riesgo a validar',
                'Foco de entrevista',
              ].map((label) => (
                <div key={label} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-600">
                  {label}
                </div>
              ))}
            </div>

            {candidates.map((candidate) => {
              const decision = buildCandidateDecision(candidate);
              const meta = getRecruiterDecisionMeta(decision.decision);
              const recommendationMeta = getVacancyRecommendationMeta(decision.recommendation);
              const isShortlisted = Boolean(candidate.shortlistManual);
              return (
                <div key={candidate.id} className="space-y-3">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{candidate.name}</p>
                        <p className="text-sm text-slate-500">{candidate.vacancy}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-cyan-700 hover:bg-cyan-50" onClick={() => onViewCandidate(candidate)}>
                        Abrir ficha
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={isShortlisted ? 'outline' : 'default'}
                        className={isShortlisted ? 'border-slate-200 text-slate-700' : 'bg-cyan-600 text-white hover:bg-cyan-500'}
                        onClick={() => onToggleShortlistCandidate(candidate)}
                      >
                        {isShortlisted ? 'Quitar shortlist' : 'Guardar shortlist'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 font-[family:var(--font-admin-mono)] text-2xl font-semibold text-slate-950">
                    {candidate.totalScore ?? '--'}
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                    <Badge className={meta.badgeClass}>{decision.label}</Badge>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                    <Badge className={recommendationMeta.badgeClass}>{recommendationMeta.label}</Badge>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-700">
                    {isShortlisted ? 'Sí, recruiter lo sostuvo manualmente.' : 'No está en shortlist manual.'}
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 font-[family:var(--font-admin-mono)] text-slate-900">
                    {candidate.technicalScore ?? '--'}
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 font-[family:var(--font-admin-mono)] text-slate-900">
                    {candidate.cognitiveScore ?? '--'}
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 font-[family:var(--font-admin-mono)] text-slate-900">
                    {candidate.softSkillsScore ?? '--'}
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm leading-relaxed text-emerald-900">
                    {decision.strengths[0] || 'Sin fortaleza dominante clara todavía.'}
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900">
                    {decision.risks[0] || 'Sin riesgo crítico visible en esta lectura.'}
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
                    {decision.prompts[0]?.question || 'Validación general en entrevista.'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin registro';
  return new Intl.DateTimeFormat('es-UY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getActivityTone(action: string) {
  if (action === 'create-job') return 'text-cyan-700 bg-cyan-50 border-cyan-200';
  if (action === 'import-assessment') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (action === 'schedule-interview') return 'text-amber-700 bg-amber-50 border-amber-200';
  if (action === 'create-candidate') return 'text-sky-700 bg-sky-50 border-sky-200';
  if (action === 'update-candidate-status') return 'text-violet-700 bg-violet-50 border-violet-200';
  if (action === 'shortlist-candidate' || action === 'unshortlist-candidate') return 'text-cyan-700 bg-cyan-50 border-cyan-200';
  if (action === 'set-vacancy-recommendation') return 'text-teal-700 bg-teal-50 border-teal-200';
  if (action === 'update-workspace') return 'text-slate-700 bg-slate-100 border-slate-200';
  return 'text-slate-700 bg-slate-50 border-slate-200';
}

function getActivityIcon(action: string) {
  if (action === 'create-job') return BriefcaseBusiness;
  if (action === 'import-assessment') return ClipboardCheck;
  if (action === 'schedule-interview') return CalendarClock;
  if (action === 'create-candidate') return UsersRound;
  if (action === 'update-candidate-status') return Sparkles;
  if (action === 'shortlist-candidate' || action === 'unshortlist-candidate') return ShieldCheck;
  if (action === 'set-vacancy-recommendation') return Sparkles;
  if (action === 'update-workspace') return Save;
  return Activity;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'create-job': 'Crear vacante',
  'import-assessment': 'Vincular resultado manual',
  'schedule-interview': 'Agendar entrevista',
  'create-candidate': 'Crear candidato',
  'update-candidate-status': 'Cambiar estado',
  'shortlist-candidate': 'Guardar shortlist',
  'unshortlist-candidate': 'Quitar shortlist',
  'set-vacancy-recommendation': 'Definir recomendación',
  'update-workspace': 'Editar workspace',
};

function formatAuditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function AdminDashboardShell() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterValue, setFilterValue] = useState('all');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [isRecruiterAccessValidated, setIsRecruiterAccessValidated] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [recruiterSession, setRecruiterSession] = useState<RecruiterAccessSession | null>(null);
  const [isUpdatingCandidate, setIsUpdatingCandidate] = useState(false);
  const [auditBundle, setAuditBundle] = useState<RecruiterAuditBundle>({
    activeSessions: [],
    recentAccesses: [],
    recentClosures: [],
    recentEvents: [],
  });
  const [auditSearchValue, setAuditSearchValue] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditSessionFilter, setAuditSessionFilter] = useState<'all' | 'active' | 'closed'>('all');

  const [workspace, setWorkspace] = useState<AdminWorkspace>(createEmptyWorkspace());
  const [settingsDraft, setSettingsDraft] = useState<Pick<AdminWorkspace, 'organizationName' | 'ownerName' | 'ownerRole'>>({
    organizationName: '',
    ownerName: '',
    ownerRole: '',
  });
  const [assessmentRecords, setAssessmentRecords] = useState<AssessmentImportRecord[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null);

  const [isCreateVacancyOpen, setIsCreateVacancyOpen] = useState(false);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [isImportAssessmentsOpen, setIsImportAssessmentsOpen] = useState(false);
  const [isScheduleInterviewOpen, setIsScheduleInterviewOpen] = useState(false);

  const applyWorkspace = (nextWorkspace: AdminWorkspace) => {
    setWorkspace(nextWorkspace);
    setSettingsDraft({
      organizationName: nextWorkspace.organizationName,
      ownerName: nextWorkspace.ownerName,
      ownerRole: nextWorkspace.ownerRole,
    });
  };

  const setErrorFrom = useCallback((error: unknown, fallback: string) => {
    setApiError(error instanceof Error ? error.message : fallback);
  }, []);

  const refreshAssessmentRecords = useCallback(async () => {
    const response = await fetchAdminAssessmentResults();
    setAssessmentRecords(response.results);
  }, []);

  const refreshRecruiterAudit = useCallback(async () => {
    const response = await fetchRecruiterAudit();
    setAuditBundle(response.audit);
  }, []);

  const handleLogout = useCallback(async () => {
    const session = recruiterSession;
    clearRecruiterAccessSession();
    setRecruiterSession(null);
    setIsRecruiterAccessValidated(false);

    if (session) {
      try {
        await endRecruiterAccess({
          sessionId: session.sessionId,
          name: session.name,
          email: session.email,
        });
      } catch (error) {
        console.error('Failed to persist recruiter logout', error);
      }
    }

    router.replace('/');
  }, [recruiterSession, router]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [workspaceResponse, assessmentResponse, auditResponse] = await Promise.all([
          fetchAdminWorkspace(),
          fetchAdminAssessmentResults(),
          fetchRecruiterAudit(),
        ]);
        applyWorkspace(workspaceResponse.workspace);
        setAssessmentRecords(assessmentResponse.results);
        setAuditBundle(auditResponse.audit);
      } catch (error) {
        setErrorFrom(error, 'No se pudo cargar el workspace');
      } finally {
        setIsBootstrapped(true);
      }
    };

    void bootstrap();
  }, [refreshRecruiterAudit, setErrorFrom]);

  useEffect(() => {
    const session = readRecruiterAccessSession();
    if (!session) {
      router.replace('/');
      return;
    }
    setRecruiterSession(session);
    setIsRecruiterAccessValidated(true);
  }, [router]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('initium-admin-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme);
      return;
    }
    setTheme('light');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('initium-admin-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!isBootstrapped) return;
    const refresh = () => {
      void Promise.all([refreshAssessmentRecords(), refreshRecruiterAudit()]).catch((error) => {
        setErrorFrom(error, 'No se pudieron refrescar los datos del workspace');
      });
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [isBootstrapped, refreshAssessmentRecords, refreshRecruiterAudit, setErrorFrom]);

  const jobs = workspace.jobs;
  const candidates = workspace.candidates;
  const interviews = workspace.interviews;
  const effectiveOwnerName = recruiterSession?.name || workspace.ownerName;
  const effectiveOwnerRole = recruiterSession?.email || workspace.ownerRole;

  const logRecruiterActivity = useCallback(
    async ({
      action,
      entityType,
      entityId,
      summary,
      details,
    }: {
      action: string;
      entityType?: string;
      entityId?: string;
      summary: string;
      details?: string;
    }) => {
      if (!recruiterSession) return;
      try {
        await recordRecruiterActivity({
          sessionId: recruiterSession.sessionId,
          recruiterName: recruiterSession.name,
          recruiterEmail: recruiterSession.email,
          action,
          entityType,
          entityId,
          summary,
          details,
        });
        await refreshRecruiterAudit();
      } catch (error) {
        console.error('Failed to persist recruiter activity', error);
      }
    },
    [recruiterSession, refreshRecruiterAudit]
  );

  const filteredActiveAuditSessions = useMemo(() => {
    const query = auditSearchValue.trim().toLowerCase();
    return auditBundle.activeSessions.filter((session) => {
      if (auditSessionFilter !== 'all' && session.status !== auditSessionFilter) return false;
      if (!query) return true;
      return [session.recruiterName, session.recruiterEmail, session.sessionId].some((value) => value.toLowerCase().includes(query));
    });
  }, [auditBundle.activeSessions, auditSearchValue, auditSessionFilter]);

  const filteredRecentAccesses = useMemo(() => {
    const query = auditSearchValue.trim().toLowerCase();
    return auditBundle.recentAccesses.filter((session) => {
      if (auditSessionFilter !== 'all' && session.status !== auditSessionFilter) return false;
      if (!query) return true;
      return [session.recruiterName, session.recruiterEmail, session.sessionId].some((value) => value.toLowerCase().includes(query));
    });
  }, [auditBundle.recentAccesses, auditSearchValue, auditSessionFilter]);

  const filteredRecentClosures = useMemo(() => {
    const query = auditSearchValue.trim().toLowerCase();
    return auditBundle.recentClosures.filter((session) => {
      if (auditSessionFilter !== 'all' && session.status !== auditSessionFilter) return false;
      if (!query) return true;
      return [session.recruiterName, session.recruiterEmail, session.sessionId].some((value) => value.toLowerCase().includes(query));
    });
  }, [auditBundle.recentClosures, auditSearchValue, auditSessionFilter]);

  const filteredAuditEvents = useMemo(() => {
    const query = auditSearchValue.trim().toLowerCase();
    return auditBundle.recentEvents.filter((event) => {
      if (auditActionFilter !== 'all' && event.action !== auditActionFilter) return false;
      if (!query) return true;
      return [event.recruiterName, event.recruiterEmail, event.summary, event.details || '', event.entityId || '']
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [auditActionFilter, auditBundle.recentEvents, auditSearchValue]);

  const auditActionOptions = useMemo(
    () =>
      Array.from(new Set(auditBundle.recentEvents.map((event) => event.action))).sort((a, b) => a.localeCompare(b)),
    [auditBundle.recentEvents]
  );

  const exportAuditCsv = useCallback(() => {
    const rows: string[] = [];
    const headers = [
      'categoria',
      'accion',
      'recruiter_nombre',
      'recruiter_email',
      'session_id',
      'estado',
      'ocurrido_en',
      'resumen',
      'detalle',
      'entidad',
      'entity_id',
    ];
    rows.push(headers.join(','));

    filteredAuditEvents.forEach((event) => {
      const values = [
        'evento',
        formatAuditActionLabel(event.action),
        event.recruiterName,
        event.recruiterEmail,
        event.sessionId,
        '',
        event.occurredAt,
        event.summary,
        event.details || '',
        event.entityType || '',
        event.entityId || '',
      ];
      rows.push(values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
    });

    filteredRecentAccesses.forEach((session) => {
      const values = [
        'acceso',
        'Login recruiter',
        session.recruiterName,
        session.recruiterEmail,
        session.sessionId,
        session.status,
        session.startedAt,
        'Ingreso al dashboard',
        '',
        '',
        '',
      ];
      rows.push(values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
    });

    filteredRecentClosures.forEach((session) => {
      const values = [
        'cierre',
        'Logout recruiter',
        session.recruiterName,
        session.recruiterEmail,
        session.sessionId,
        session.status,
        session.endedAt || '',
        'Cierre de sesión',
        '',
        '',
        '',
      ];
      rows.push(values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `initium-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filteredAuditEvents, filteredRecentAccesses, filteredRecentClosures]);

  const filterOptions = useMemo(() => buildFilterOptions(jobs), [jobs]);
  const unimportedAssessments = useMemo(
    () =>
      assessmentRecords.filter(
        (record) => !record.importedCandidateId && !candidates.some((candidate) => candidate.assessmentId === record.id)
      ),
    [assessmentRecords, candidates]
  );
  const navItems = useMemo(() => buildNavItems({ candidates, jobs, interviews }), [candidates, jobs, interviews]);

  const filteredCandidates = useMemo(
    () =>
      candidates.filter((candidate) =>
        matchesSearch(searchValue, [candidate.name, candidate.email, candidate.vacancy, candidate.department, candidate.recruiter]) &&
        matchesScope(filterValue, { department: candidate.department, vacancyId: candidate.vacancyId })
      ),
    [candidates, filterValue, searchValue]
  );

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => matchesSearch(searchValue, [job.title, job.department, job.owner, job.location]) && matchesScope(filterValue, { department: job.department, id: job.id })),
    [filterValue, jobs, searchValue]
  );

  const filteredInterviews = useMemo(
    () =>
      interviews.filter((interview) =>
        matchesSearch(searchValue, [interview.candidateName, interview.vacancy, interview.interviewer, interview.department]) &&
        matchesScope(filterValue, { department: interview.department, vacancyId: interview.vacancyId })
      ),
    [filterValue, interviews, searchValue]
  );

  const jobsWithStats = useMemo<JobOpeningWithStats[]>(() => {
    return filteredJobs.map((job) => {
      const jobCandidates = candidates.filter((candidate) => candidate.vacancyId === job.id);
      const jobInterviews = interviews.filter((interview) => interview.vacancyId === job.id);
      const recommendedCount = jobCandidates.filter((candidate) => buildCandidateDecision(candidate).recommendation === 'recommended').length;
      const reserveCount = jobCandidates.filter((candidate) => buildCandidateDecision(candidate).recommendation === 'reserve').length;
      const noAdvanceCount = jobCandidates.filter((candidate) => buildCandidateDecision(candidate).recommendation === 'no-advance').length;
      return {
        ...job,
        appliedCount: jobCandidates.length,
        assessmentCount: jobCandidates.filter((candidate) => candidate.pipelineStage === 'assessment').length,
        interviewCount: jobInterviews.length,
        hiredCount: jobCandidates.filter((candidate) => candidate.pipelineStage === 'hired').length,
        shortlistedCount: jobCandidates.filter((candidate) => Boolean(candidate.shortlistManual)).length,
        recommendedCount,
        reserveCount,
        noAdvanceCount,
      };
    });
  }, [candidates, filteredJobs, interviews]);

  const pipelineStages = useMemo<PipelineStage[]>(() => {
    return PIPELINE_STAGE_META.map((stage, index) => {
      const count = filteredCandidates.filter((candidate) => candidate.pipelineStage === stage.id).length;
      const previousCount = index === 0 ? count : filteredCandidates.filter((candidate) => candidate.pipelineStage === PIPELINE_STAGE_META[index - 1].id).length;
      const conversion = index === 0 ? 100 : previousCount > 0 ? Math.round((count / previousCount) * 100) : 0;
      return {
        id: stage.id,
        label: stage.label,
        count,
        conversion,
        color: stage.color,
      };
    });
  }, [filteredCandidates]);

  const fitCategories = useMemo<FitScoreCategory[]>(() => {
    const candidatesWithFit = filteredCandidates.filter((candidate) => candidate.fitScores);
    if (!candidatesWithFit.length) return [];

    return [
      {
        id: 'technical-match',
        label: 'Technical Match',
        value: average(candidatesWithFit.map((candidate) => candidate.fitScores?.technicalMatch ?? 0)),
        note: `${candidatesWithFit.length} perfiles con medición técnica consolidada.`,
      },
      {
        id: 'cognitive-performance',
        label: 'Cognitive Performance',
        value: average(candidatesWithFit.map((candidate) => candidate.fitScores?.cognitivePerformance ?? 0)),
        note: 'Promedio agregado de capacidad de procesamiento y precisión.',
      },
      {
        id: 'behavioral-fit',
        label: 'Behavioral Fit',
        value: average(candidatesWithFit.map((candidate) => candidate.fitScores?.behavioralFit ?? 0)),
        note: 'Señal consolidada de fit conductual y respuesta operativa.',
      },
      {
        id: 'communication',
        label: 'Communication',
        value: average(candidatesWithFit.map((candidate) => candidate.fitScores?.communication ?? 0)),
        note: 'Claridad y estructura observadas en las respuestas evaluadas.',
      },
      {
        id: 'leadership-potential',
        label: 'Leadership Potential',
        value: average(candidatesWithFit.map((candidate) => candidate.fitScores?.leadershipPotential ?? 0)),
        note: 'Capacidad promedio de coordinación, criterio y priorización.',
      },
      {
        id: 'culture-fit',
        label: 'Culture Fit',
        value: average(candidatesWithFit.map((candidate) => candidate.fitScores?.cultureFit ?? 0)),
        note: 'Ajuste cultural estimado a partir de señales blandas y estratégicas.',
      },
    ];
  }, [filteredCandidates]);

  const decisionCandidates = useMemo(
    () => sortCandidatesForDecision(filteredCandidates.filter((candidate) => candidate.totalScore != null)),
    [filteredCandidates]
  );

  const recruiterDecisionSummary = useMemo(() => {
    return decisionCandidates.reduce(
      (accumulator, candidate) => {
        const decision = buildCandidateDecision(candidate).decision;
        if (decision === 'advance') accumulator.advance += 1;
        if (decision === 'review') accumulator.review += 1;
        if (decision === 'decline') accumulator.decline += 1;
        return accumulator;
      },
      { advance: 0, review: 0, decline: 0 }
    );
  }, [decisionCandidates]);

  const shortlistSuggestions = useMemo(() => {
    const prioritized = decisionCandidates.filter((candidate) => buildCandidateDecision(candidate).shortlistEligible);
    if (prioritized.length) return prioritized.slice(0, 4);
    return decisionCandidates.filter((candidate) => buildCandidateDecision(candidate).decision !== 'decline').slice(0, 4);
  }, [decisionCandidates]);

  const comparisonCandidates = useMemo(() => decisionCandidates.slice(0, 3), [decisionCandidates]);

  const alerts = useMemo<AlertItem[]>(() => {
    const nextAlerts: AlertItem[] = [];
    if (unimportedAssessments.length > 0) {
      nextAlerts.push({
        id: 'import-assessments',
        title: 'Resultados sin vincular',
        description: `${unimportedAssessments.length} resultados no pudieron sincronizarse automáticamente con una vacante y requieren revisión manual.`,
        severity: 'info',
        meta: 'Revisión asistida',
        actionLabel: 'Revisar sync',
      });
    }

    const pendingInterviews = interviews.filter((interview) => interview.status === 'pending');
    if (pendingInterviews.length > 0) {
      nextAlerts.push({
        id: 'pending-interviews',
        title: 'Entrevistas por confirmar',
        description: `${pendingInterviews.length} entrevistas siguen en estado pendiente y requieren confirmación.`,
        severity: 'warning',
        meta: 'Agenda viva',
        actionLabel: 'Revisar entrevistas',
      });
    }

    const lowConversionJobs = jobsWithStats.filter((job) => job.appliedCount >= 3 && job.interviewCount === 0);
    if (lowConversionJobs.length > 0) {
      nextAlerts.push({
        id: 'low-conversion',
        title: 'Vacantes con baja conversión',
        description: `${lowConversionJobs.length} vacantes tienen candidatos aplicados pero todavía no pasaron a entrevista.`,
        severity: 'critical',
        meta: 'Pipeline audit',
        actionLabel: 'Auditar funnel',
      });
    }

    const standoutCandidates = candidates.filter((candidate) => (candidate.totalScore ?? 0) >= 85 && candidate.status !== 'rejected');
    if (standoutCandidates.length > 0) {
      nextAlerts.push({
        id: 'standout-candidates',
        title: 'Candidatos destacados',
        description: `${standoutCandidates.length} perfiles superan 85/100 y pueden priorizarse en shortlist o entrevista.`,
        severity: 'success',
        meta: 'Scores altos',
        actionLabel: 'Abrir candidatos',
      });
    }

    return nextAlerts;
  }, [candidates, interviews, jobsWithStats, unimportedAssessments.length]);

  const reportCards = useMemo<ReportCard[]>(() => {
    const candidatesWithScores = candidates.filter((candidate) => candidate.totalScore != null);
    const scoreCoverage = candidates.length > 0 ? Math.round((candidatesWithScores.length / candidates.length) * 100) : 0;
    const assessmentStageCandidates = candidates.filter((candidate) => ['assessment', 'interview', 'final-review', 'hired'].includes(candidate.pipelineStage));
    const interviewReady = candidates.filter((candidate) => ['interview', 'final-review', 'hired'].includes(candidate.pipelineStage));
    const advancementRate = assessmentStageCandidates.length > 0 ? Math.round((interviewReady.length / assessmentStageCandidates.length) * 100) : 0;
    const activeJobs = jobs.filter((job) => job.status === 'active').length;

    return [
      {
        id: 'score-coverage',
        title: 'Cobertura assessment',
        value: `${scoreCoverage}%`,
        delta: unimportedAssessments.length ? `${unimportedAssessments.length} sin vincular` : 'Sync automático activo',
        description: 'Porcentaje de candidatos del pipeline que ya tienen resultados asociados.',
      },
      {
        id: 'advancement-rate',
        title: 'Assessment → Interview',
        value: `${advancementRate}%`,
        delta: `${interviewReady.length} candidatos`,
        description: 'Tasa real de avance desde assessment hacia entrevista.',
      },
      {
        id: 'active-jobs',
        title: 'Vacantes activas',
        value: String(activeJobs),
        delta: `${jobs.length} vacantes totales`,
        description: 'Cantidad de roles activos hoy dentro del workspace.',
      },
    ];
  }, [candidates, jobs, unimportedAssessments.length]);

  const dynamicKpis = useMemo<KpiMetric[]>(() => {
    const candidatesInPipeline = candidates.filter((candidate) => !['rejected', 'hired'].includes(candidate.status)).length;
    const pipelineDates = countByPeriod(candidates.map((candidate) => candidate.appliedAt));

    const evaluationsCompleted = candidates.filter((candidate) => candidate.totalScore != null).length;
    const evaluationDates = countByPeriod(candidates.filter((candidate) => candidate.totalScore != null).map((candidate) => candidate.updatedAt));

    const interviewDates = countByPeriod(interviews.map((interview) => interview.scheduledAt));
    const activeJobs = jobs.filter((job) => job.status === 'active').length;
    const jobDates = countByPeriod(jobs.map((job) => job.postedAt));

    const assessmentStageCandidates = candidates.filter((candidate) => ['assessment', 'interview', 'final-review', 'hired'].includes(candidate.pipelineStage));
    const interviewStageCandidates = candidates.filter((candidate) => ['interview', 'final-review', 'hired'].includes(candidate.pipelineStage));
    const advancementValue = assessmentStageCandidates.length > 0 ? Math.round((interviewStageCandidates.length / assessmentStageCandidates.length) * 100) : 0;

    const currentAssessmentWindow = candidates.filter((candidate) => new Date(candidate.updatedAt) >= daysAgo(30) && ['assessment', 'interview', 'final-review', 'hired'].includes(candidate.pipelineStage)).length;
    const previousAssessmentWindow = candidates.filter((candidate) => {
      const date = new Date(candidate.updatedAt);
      return date >= daysAgo(60) && date < daysAgo(30) && ['assessment', 'interview', 'final-review', 'hired'].includes(candidate.pipelineStage);
    }).length;
    const currentInterviewWindow = candidates.filter((candidate) => new Date(candidate.updatedAt) >= daysAgo(30) && ['interview', 'final-review', 'hired'].includes(candidate.pipelineStage)).length;
    const previousInterviewWindow = candidates.filter((candidate) => {
      const date = new Date(candidate.updatedAt);
      return date >= daysAgo(60) && date < daysAgo(30) && ['interview', 'final-review', 'hired'].includes(candidate.pipelineStage);
    }).length;
    const advancementDelta = calculateDelta(currentInterviewWindow, previousInterviewWindow || previousAssessmentWindow);

    const hiredDurations = candidates
      .filter((candidate) => candidate.hiredAt)
      .map((candidate) => ({
        value: Math.round((new Date(candidate.hiredAt as string).getTime() - new Date(candidate.appliedAt).getTime()) / 86400000),
        date: candidate.hiredAt as string,
      }))
      .filter((item) => Number.isFinite(item.value) && item.value >= 0);
    const hireAverages = computeAverageForPeriod(hiredDurations);
    const timeToHireValue = hiredDurations.length ? `${average(hiredDurations.map((item) => item.value))} días` : '--';
    const timeToHireDelta = hireAverages.current != null && hireAverages.previous != null ? calculateDelta(hireAverages.current, hireAverages.previous) : null;

    return [
      {
        id: 'pipeline',
        title: 'Candidatos en pipeline',
        value: String(candidatesInPipeline),
        delta: calculateDelta(pipelineDates.current, pipelineDates.previous),
        improvesWhen: 'higher',
        icon: UsersRound,
        caption: 'candidatos activos hoy',
      },
      {
        id: 'assessments',
        title: 'Evaluaciones completadas',
        value: String(evaluationsCompleted),
        delta: calculateDelta(evaluationDates.current, evaluationDates.previous),
        improvesWhen: 'higher',
        icon: ClipboardCheck,
        caption: 'scores asociados',
      },
      {
        id: 'interviews',
        title: 'Entrevistas agendadas',
        value: String(interviews.length),
        delta: calculateDelta(interviewDates.current, interviewDates.previous),
        improvesWhen: 'higher',
        icon: CalendarClock,
        caption: 'agenda cargada',
      },
      {
        id: 'jobs',
        title: 'Vacantes activas',
        value: String(activeJobs),
        delta: calculateDelta(jobDates.current, jobDates.previous),
        improvesWhen: 'higher',
        icon: BriefcaseBusiness,
        caption: 'roles abiertos',
      },
      {
        id: 'advancement',
        title: 'Tasa de avance',
        value: `${advancementValue}%`,
        delta: advancementDelta,
        improvesWhen: 'higher',
        icon: Sparkles,
        caption: 'de assessment a entrevista',
      },
      {
        id: 'time-to-hire',
        title: 'Tiempo prom. de contratación',
        value: timeToHireValue,
        delta: timeToHireDelta,
        improvesWhen: 'lower',
        icon: BarChart3,
        caption: 'ciclos cerrados',
      },
    ];
  }, [candidates, interviews, jobs]);

  const handleCreateVacancy = async ({
    title,
    department,
    location,
    scoreProfileId,
  }: {
    title: string;
    department: string;
    location: string;
    scoreProfileId: VacancyScoreProfileId;
  }) => {
    try {
      const response = await createAdminJob({
        title,
        department,
        location,
        owner: effectiveOwnerName,
        scoreProfileId,
      });
      applyWorkspace(response.workspace);
      await logRecruiterActivity({
        action: 'create-job',
        entityType: 'job',
        summary: `Creó la vacante ${title}`,
        details: `Área: ${department}. Ubicación: ${location}.`,
      });
      setApiError(null);
      setActiveView('jobs');
      setFilterValue('all');
    } catch (error) {
      setErrorFrom(error, 'No se pudo crear la vacante');
    }
  };

  const handleCreateCandidate = async (payload: AddCandidatePayload) => {
    const job = jobs.find((item) => item.id === payload.vacancyId);
    if (!job) {
      setApiError('Debes crear o seleccionar una vacante antes de cargar candidatos');
      return;
    }

    const summary = buildManualCandidateSummaryForJob({
      job,
      technicalScore: payload.technicalScore,
      cognitiveScore: payload.cognitiveScore,
      softSkillsScore: payload.softSkillsScore,
    });
    const now = new Date().toISOString();
    const nextCandidate: CandidateResult = {
      id: `candidate-${crypto.randomUUID()}`,
      name: payload.name,
      email: payload.email,
      vacancyId: job.id,
      vacancy: job.title,
      department: job.department,
      totalScore: summary.totalScore,
      technicalScore: summary.technicalScore,
      cognitiveScore: summary.cognitiveScore,
      softSkillsScore: summary.softSkillsScore,
      fitScores: summary.fitScores,
      status: normalizeCandidateStatus(payload.status, payload.pipelineStage),
      pipelineStage: payload.pipelineStage,
      appliedAt: now,
      updatedAt: now,
      location: payload.location || 'Sin ubicación',
      recruiter: effectiveOwnerName,
      source: 'manual',
      hiredAt: payload.pipelineStage === 'hired' || payload.status === 'hired' ? now : undefined,
      scoreProfileId: summary.scoreProfileId,
    };

    try {
      const response = await createAdminCandidate(nextCandidate);
      applyWorkspace(response.workspace);
      await logRecruiterActivity({
        action: 'create-candidate',
        entityType: 'candidate',
        entityId: nextCandidate.id,
        summary: `Creó el candidato ${payload.name}`,
        details: `${job.title} · ${payload.status} · ${payload.pipelineStage}.`,
      });
      setApiError(null);
      setActiveView('candidates');
    } catch (error) {
      setErrorFrom(error, 'No se pudo crear el candidato');
    }
  };

  const handleScheduleInterview = async (payload: ScheduleInterviewPayload) => {
    const candidate = candidates.find((item) => item.id === payload.candidateId);
    if (!candidate) {
      setApiError('El candidato seleccionado ya no existe en el workspace');
      return;
    }

    const nextInterview: UpcomingInterview = {
      id: `interview-${crypto.randomUUID()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      vacancyId: candidate.vacancyId,
      vacancy: candidate.vacancy,
      department: candidate.department,
      scheduledAt: `${payload.date}T${payload.time}:00`,
      interviewer: payload.interviewer,
      status: payload.status,
      format: payload.format,
    };

    try {
      const response = await createAdminInterview(nextInterview);
      applyWorkspace(response.workspace);
      await logRecruiterActivity({
        action: 'schedule-interview',
        entityType: 'interview',
        entityId: nextInterview.id,
        summary: `Agendó entrevista para ${candidate.name}`,
        details: `${candidate.vacancy} · ${payload.date} ${payload.time} · ${payload.format}.`,
      });
      setApiError(null);
      setActiveView('interviews');
    } catch (error) {
      setErrorFrom(error, 'No se pudo agendar la entrevista');
    }
  };

  const handleImportAssessment = async (assessmentId: string, vacancyId: string) => {
    const record = assessmentRecords.find((item) => item.id === assessmentId);
    const job = jobs.find((item) => item.id === vacancyId);
    if (!record || !job) {
      setApiError('La vacante o el resultado seleccionado ya no está disponible');
      return;
    }

    const importedCandidate = buildCandidateFromAssessment({
      record,
      job,
      recruiter: effectiveOwnerName,
    });

    try {
      const response = await createAdminCandidate(importedCandidate);
      applyWorkspace(response.workspace);
      await refreshAssessmentRecords();
      await logRecruiterActivity({
        action: 'import-assessment',
        entityType: 'assessment',
        entityId: record.id,
        summary: `Importó assessment de ${record.candidateName}`,
        details: `Vacante destino: ${job.title}. Score total: ${record.totalScore}.`,
      });
      setApiError(null);
    } catch (error) {
      setErrorFrom(error, 'No se pudo importar el resultado del assessment');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      const response = await saveAdminWorkspaceSettings(settingsDraft);
      applyWorkspace(response.workspace);
      await logRecruiterActivity({
        action: 'update-workspace',
        entityType: 'workspace',
        entityId: 'workspace-1',
        summary: 'Actualizó la configuración del workspace',
        details: `${settingsDraft.organizationName} · ${settingsDraft.ownerName} · ${settingsDraft.ownerRole}.`,
      });
      setApiError(null);
    } catch (error) {
      setErrorFrom(error, 'No se pudo guardar la configuración del workspace');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdateCandidateProgress = async ({
    id,
    status,
    pipelineStage,
    shortlistManual,
    vacancyRecommendation,
  }: {
    id: string;
    status: CandidateStatus;
    pipelineStage: CandidatePipelineStage;
    shortlistManual?: boolean;
    vacancyRecommendation?: VacancyRecommendation;
  }, auditOverride?: { action?: string; summary?: string; details?: string }) => {
    try {
      setIsUpdatingCandidate(true);
      const currentCandidate = candidates.find((candidate) => candidate.id === id);
      const inferredAction =
        !auditOverride?.action &&
        currentCandidate &&
        currentCandidate.status === status &&
        currentCandidate.pipelineStage === pipelineStage &&
        typeof shortlistManual !== 'boolean' &&
        vacancyRecommendation &&
        vacancyRecommendation !== currentCandidate.vacancyRecommendation
          ? 'set-vacancy-recommendation'
          : undefined;
      const response = await updateAdminCandidate({ id, status, pipelineStage, shortlistManual, vacancyRecommendation });
      applyWorkspace(response.workspace);
      const updatedCandidate = response.workspace.candidates.find((candidate) => candidate.id === id) || null;
      setSelectedCandidate(updatedCandidate);
      await logRecruiterActivity({
        action: auditOverride?.action || inferredAction || 'update-candidate-status',
        entityType: 'candidate',
        entityId: id,
        summary: auditOverride?.summary || `Actualizó el avance de ${updatedCandidate?.name || 'un candidato'}`,
        details:
          auditOverride?.details ||
          `${pipelineStage} · ${status}${typeof shortlistManual === 'boolean' ? ` · shortlist ${shortlistManual ? 'on' : 'off'}` : ''}${vacancyRecommendation ? ` · recomendación ${vacancyRecommendation}` : ''}.`,
      });
      setApiError(null);
    } catch (error) {
      setErrorFrom(error, 'No se pudo actualizar el estado del candidato');
    } finally {
      setIsUpdatingCandidate(false);
    }
  };

  const handleShortlistCandidate = async (candidate: CandidateResult) => {
    const decision = buildCandidateDecision(candidate);
    await handleUpdateCandidateProgress(
      {
        id: candidate.id,
        status: decision.suggestedStatus,
        pipelineStage: decision.suggestedStage,
        shortlistManual: true,
        vacancyRecommendation: 'recommended',
      },
      {
        action: 'shortlist-candidate',
        summary: `Priorizó a ${candidate.name} para avanzar`,
        details: `${decision.label} · ${decision.nextStep} · shortlist manual activado.`,
      }
    );
  };

  const handleToggleShortlistCandidate = async (candidate: CandidateResult) => {
    const nextShortlist = !candidate.shortlistManual;
    const nextRecommendation =
      nextShortlist
        ? 'recommended'
        : candidate.vacancyRecommendationSource === 'manual' && candidate.vacancyRecommendation === 'recommended'
          ? buildCandidateDecision({ ...candidate, shortlistManual: false, vacancyRecommendation: undefined }).recommendation
          : candidate.vacancyRecommendation;

    await handleUpdateCandidateProgress(
      {
        id: candidate.id,
        status: nextShortlist ? 'shortlisted' : candidate.status,
        pipelineStage: nextShortlist && candidate.pipelineStage === 'applied' ? 'screening' : candidate.pipelineStage,
        shortlistManual: nextShortlist,
        vacancyRecommendation: nextRecommendation,
      },
      {
        action: nextShortlist ? 'shortlist-candidate' : 'unshortlist-candidate',
        summary: `${nextShortlist ? 'Guardó' : 'Quitó'} a ${candidate.name} del shortlist`,
        details: nextShortlist
          ? 'Shortlist manual activado y recomendación ajustada a recomendado.'
          : 'Shortlist manual desactivado; se mantiene la lectura general del perfil.',
      }
    );
  };

  const renderDashboardView = () => (
    <div className="space-y-6">
      {jobs.length === 0 || candidates.length === 0 || unimportedAssessments.length > 0 ? (
        <WorkspaceOnboarding
          hasJobs={jobs.length > 0}
          hasCandidates={candidates.length > 0}
          hasImports={unimportedAssessments.length > 0}
          onCreateVacancy={() => setIsCreateVacancyOpen(true)}
          onAddCandidate={() => setIsAddCandidateOpen(true)}
          onImportAssessments={() => setIsImportAssessmentsOpen(true)}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {dynamicKpis.map((metric) => (
          <KpiCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]">
        <PipelineChart stages={pipelineStages} />
        <FitScoreWidget categories={fitCategories} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DecisionStatCard
          title="Avanzar ahora"
          value={String(recruiterDecisionSummary.advance)}
          hint="perfiles listos para shortlist"
          decision="advance"
          icon={Sparkles}
        />
        <DecisionStatCard
          title="Revisión táctica"
          value={String(recruiterDecisionSummary.review)}
          hint="necesitan contraste breve"
          decision="review"
          icon={ClipboardCheck}
        />
        <DecisionStatCard
          title="No avanzar"
          value={String(recruiterDecisionSummary.decline)}
          hint="riesgo alto frente al score observado"
          decision="decline"
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
        <DecisionQueueCard
          candidates={shortlistSuggestions}
          onViewCandidate={setSelectedCandidate}
          onShortlistCandidate={(candidate) => void handleShortlistCandidate(candidate)}
          onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
        />
        <CandidateComparisonCard
          candidates={comparisonCandidates}
          onViewCandidate={setSelectedCandidate}
          onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]">
        <CandidateResultsTable
          candidates={filteredCandidates.slice(0, 6)}
          onViewCandidate={setSelectedCandidate}
          onShortlistCandidate={(candidate) => void handleShortlistCandidate(candidate)}
          onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
        />
        <UpcomingInterviews interviews={filteredInterviews.slice(0, 4)} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]">
        <ActiveJobsTable jobs={jobsWithStats} />
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );

  const renderCandidatesView = () => (
    <div className="space-y-6">
      <ViewIntro view="candidates" />
      <div className="grid gap-4 md:grid-cols-3">
        <DecisionStatCard title="Avanzar ahora" value={String(recruiterDecisionSummary.advance)} hint="perfil listo para shortlist" decision="advance" icon={Sparkles} />
        <DecisionStatCard title="Revisar" value={String(recruiterDecisionSummary.review)} hint="requiere entrevista breve" decision="review" icon={ClipboardCheck} />
        <DecisionStatCard title="No avanzar" value={String(recruiterDecisionSummary.decline)} hint="riesgo operativo alto" decision="decline" icon={AlertTriangle} />
      </div>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
        <DecisionQueueCard
          candidates={shortlistSuggestions}
          onViewCandidate={setSelectedCandidate}
          onShortlistCandidate={(candidate) => void handleShortlistCandidate(candidate)}
          onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
        />
        <CandidateComparisonCard
          candidates={comparisonCandidates}
          onViewCandidate={setSelectedCandidate}
          onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
        />
      </div>
      <CandidateResultsTable
        candidates={filteredCandidates}
        title="Scorecards de candidatos"
        description="Perfiles persistidos en SQLite con sugerencia táctica para avanzar, revisar o no mover."
        onViewCandidate={setSelectedCandidate}
        onShortlistCandidate={(candidate) => void handleShortlistCandidate(candidate)}
        onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
      />
    </div>
  );

  const renderJobsView = () => (
    <div className="space-y-6">
      <ViewIntro view="jobs" />
      <div className="grid gap-4 md:grid-cols-3">
        <SmallStatCard title="Vacantes activas" value={String(jobs.filter((job) => job.status === 'active').length)} hint="persistidas en DB" icon={BriefcaseBusiness} />
        <SmallStatCard title="Pendientes" value={String(jobs.filter((job) => job.status === 'pending').length)} hint="en revisión" icon={CalendarClock} />
        <SmallStatCard title="Draft" value={String(jobs.filter((job) => job.status === 'draft').length)} hint="aún no publicadas" icon={FileSpreadsheet} />
      </div>
      <ActiveJobsTable jobs={jobsWithStats} />
    </div>
  );

  const renderPipelineView = () => (
    <div className="space-y-6">
      <ViewIntro view="pipeline" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <PipelineChart stages={pipelineStages} />
        <Card>
          <CardHeader>
            <div>
          <CardTitle>Notas operativas</CardTitle>
              <CardDescription>Lectura del funnel basada en el estado actual persistido en la base SQLite.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Etapa más cargada</p>
              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{[...pipelineStages].sort((a, b) => b.count - a.count)[0]?.label ?? 'Aplicado'}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cada creación o importación del admin impacta este bloque desde la API.</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Resultados por importar</p>
              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{unimportedAssessments.length}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Estos resultados ya se persisten en SQLite. Permanecen aquí hasta vincularlos a una vacante activa.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderInterviewsView = () => (
    <div className="space-y-6">
      <ViewIntro view="interviews" />
      <div className="grid gap-4 md:grid-cols-3">
        <SmallStatCard title="Confirmadas" value={String(filteredInterviews.filter((item) => item.status === 'confirmed').length)} hint="agenda cerrada" icon={CalendarClock} />
        <SmallStatCard title="Pendientes" value={String(filteredInterviews.filter((item) => item.status === 'pending').length)} hint="por confirmar" icon={ClipboardCheck} />
        <SmallStatCard title="Reagendadas" value={String(filteredInterviews.filter((item) => item.status === 'rescheduled').length)} hint="ajustes de agenda" icon={Sparkles} />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setIsScheduleInterviewOpen(true)}>Agendar entrevista</Button>
      </div>
      <UpcomingInterviews interviews={filteredInterviews} />
    </div>
  );

  const renderAssessmentsView = () => {
    const technicalAverage = averageNullable(filteredCandidates.map((candidate) => candidate.technicalScore));
    const cognitiveAverage = averageNullable(filteredCandidates.map((candidate) => candidate.cognitiveScore));
    const softSkillsAverage = averageNullable(filteredCandidates.map((candidate) => candidate.softSkillsScore));

    return (
      <div className="space-y-6">
        <ViewIntro view="assessments" />
        <div className="grid gap-4 md:grid-cols-3">
          <SmallStatCard title="Promedio técnico" value={technicalAverage == null ? '--' : String(technicalAverage)} hint="scores técnicos" icon={ClipboardCheck} />
          <SmallStatCard title="Promedio cognitivo" value={cognitiveAverage == null ? '--' : String(cognitiveAverage)} hint="scores cognitivos" icon={BarChart3} />
          <SmallStatCard title="Promedio soft skills" value={softSkillsAverage == null ? '--' : String(softSkillsAverage)} hint="scores blandos" icon={UsersRound} />
        </div>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)]">
        <CandidateResultsTable
            candidates={filteredCandidates.filter((candidate) => candidate.totalScore != null)}
            title="Resultados del assessment"
            description="Resultados persistidos en la base y servidos vía API del admin."
            onViewCandidate={setSelectedCandidate}
            onShortlistCandidate={(candidate) => void handleShortlistCandidate(candidate)}
            onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
          />
          <FitScoreWidget categories={fitCategories} />
        </div>
      </div>
    );
  };

  const renderAuditView = () => (
    <div className="space-y-6">
      <ViewIntro view="audit" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SmallStatCard title="Sesiones activas" value={String(filteredActiveAuditSessions.length)} hint="recruiters conectados" icon={ShieldCheck} />
        <SmallStatCard title="Accesos recientes" value={String(filteredRecentAccesses.length)} hint="últimos ingresos" icon={LogIn} />
        <SmallStatCard title="Cierres registrados" value={String(filteredRecentClosures.length)} hint="logout persistido" icon={LogOut} />
        <SmallStatCard title="Eventos operativos" value={String(filteredAuditEvents.length)} hint="acciones auditadas" icon={Activity} />
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Buscar en auditoría</label>
            <input
              value={auditSearchValue}
              onChange={(event) => setAuditSearchValue(event.target.value)}
              placeholder="Recruiter, email, resumen o sesión"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Tipo de acción</label>
            <select
              value={auditActionFilter}
              onChange={(event) => setAuditActionFilter(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <option value="all">Todas</option>
              {auditActionOptions.map((action) => (
                <option key={action} value={action}>{formatAuditActionLabel(action)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Estado de sesión</label>
            <select
              value={auditSessionFilter}
              onChange={(event) => setAuditSessionFilter(event.target.value as 'all' | 'active' | 'closed')}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="closed">Cerradas</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full xl:w-auto" onClick={exportAuditCsv}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sesiones activas</CardTitle>
              <CardDescription>Recruiters con acceso abierto ahora mismo.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {filteredActiveAuditSessions.length ? (
              filteredActiveAuditSessions.map((session) => (
                <div key={session.sessionId} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{session.recruiterName}</p>
                      <p className="text-sm text-slate-500">{session.recruiterEmail}</p>
                    </div>
                    <Badge className="border-cyan-200 bg-white text-cyan-700">Activa</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <p>Inicio: {formatDateTime(session.startedAt)}</p>
                    <p>Última actividad: {formatDateTime(session.lastSeenAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">No hay sesiones activas en este momento.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Últimos accesos</CardTitle>
              <CardDescription>Entradas recientes al dashboard recruiter.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {filteredRecentAccesses.length ? (
              filteredRecentAccesses.map((session) => (
                <div key={`${session.sessionId}-access`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{session.recruiterName}</p>
                      <p className="text-sm text-slate-500">{formatDateTime(session.startedAt)}</p>
                    </div>
                    <Badge variant="outline">{session.status === 'active' ? 'Activa' : 'Cerrada'}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">Todavía no hay accesos registrados.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cierres recientes</CardTitle>
              <CardDescription>Sesiones que ya registraron logout.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {filteredRecentClosures.length ? (
              filteredRecentClosures.map((session) => (
                <div key={`${session.sessionId}-closure`} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-medium text-slate-950">{session.recruiterName}</p>
                  <p className="mt-1 text-sm text-slate-500">{session.recruiterEmail}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5 text-cyan-600" />
                    <span>{formatDateTime(session.endedAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">Todavía no hay cierres registrados.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Actividad operativa</CardTitle>
            <CardDescription>Vacantes, candidatos, cambios de estado, entrevistas y configuración del workspace con trazabilidad recruiter.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {filteredAuditEvents.length ? (
            filteredAuditEvents.map((event) => {
              const EventIcon = getActivityIcon(event.action);
              return (
                <div key={event.id} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="rounded-2xl bg-slate-50 p-3 text-cyan-700">
                    <EventIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950">{event.summary}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getActivityTone(event.action)}`}>
                        {formatAuditActionLabel(event.action)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {event.recruiterName} · {event.recruiterEmail} · {formatDateTime(event.occurredAt)}
                    </p>
                    {event.details ? <p className="mt-2 text-sm text-slate-600">{event.details}</p> : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">Todavía no hay acciones operativas registradas.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderReportsView = () => (
    <div className="space-y-6">
      <ViewIntro view="reports" />
      <div className="grid gap-4 xl:grid-cols-3">
        {reportCards.map((report) => (
          <Card key={report.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{report.title}</p>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{report.value}</div>
                </div>
                <Badge variant="outline">{report.delta}</Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{report.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Exportables</CardTitle>
            <CardDescription>La siguiente iteración puede exponer estos datos como endpoints de export o CSV.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 pt-4">
          {['Exportar pipeline actual', 'Descargar scorecards', 'Compartir resumen semanal'].map((action) => (
            <button key={action} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-left transition hover:border-cyan-200 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-cyan-900/70 dark:hover:bg-slate-900">
              <span className="text-sm font-medium text-slate-950 dark:text-white">{action}</span>
              <Download className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderSettingsView = () => (
    <div className="space-y-6">
      <ViewIntro view="settings" />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Estos datos ahora viven en `data/initium-admin.sqlite` y se actualizan vía `/api/admin/workspace`.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre del workspace</label>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                value={settingsDraft.organizationName}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, organizationName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Responsable</label>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                value={settingsDraft.ownerName}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, ownerName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rol</label>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                value={settingsDraft.ownerRole}
                onChange={(event) => setSettingsDraft((current) => ({ ...current, ownerRole: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void handleSaveSettings()} disabled={isSavingSettings}>
              <Save className="h-4 w-4" />
              {isSavingSettings ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Persistencia actual</CardTitle>
            <CardDescription>Vacantes, candidatos, entrevistas y resultados del assessment viven en SQLite a través de la API interna.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 pt-4">
          <SmallStatCard title="Vacantes guardadas" value={String(jobs.length)} hint="SQLite" icon={BriefcaseBusiness} />
          <SmallStatCard title="Candidatos guardados" value={String(candidates.length)} hint="SQLite" icon={UsersRound} />
          <SmallStatCard title="Resultados sin vincular" value={String(unimportedAssessments.length)} hint={unimportedAssessments.length ? 'requieren revisión manual' : 'sync automático activo'} icon={Download} />
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    if (activeView === 'dashboard') return renderDashboardView();
    if (activeView === 'candidates') return renderCandidatesView();
    if (activeView === 'jobs') return renderJobsView();
    if (activeView === 'pipeline') return renderPipelineView();
    if (activeView === 'interviews') return renderInterviewsView();
    if (activeView === 'assessments') return renderAssessmentsView();
    if (activeView === 'audit') return renderAuditView();
    if (activeView === 'reports') return renderReportsView();
    return renderSettingsView();
  };

  if (!isBootstrapped || !isRecruiterAccessValidated) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.12),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_55%,#f8fafc_100%)] text-slate-950 transition-colors dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] dark:text-white">
      <div className="flex min-h-screen">
        <AdminSidebar
          items={navItems}
          activeView={activeView}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileOpen}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
          onCloseMobile={() => setMobileOpen(false)}
          onSelect={setActiveView}
        />

        <div className="flex min-w-0 flex-1 flex-col transition-all duration-300">
          <DashboardHeader
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filterValue={filterValue}
            onFilterChange={setFilterValue}
            filterOptions={filterOptions}
            onOpenCreateVacancy={() => setIsCreateVacancyOpen(true)}
            onOpenAddCandidate={() => setIsAddCandidateOpen(true)}
            onOpenImportAssessments={() => setIsImportAssessmentsOpen(true)}
            onOpenMobileMenu={() => setMobileOpen(true)}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            workspaceName={workspace.organizationName}
            ownerName={effectiveOwnerName}
            ownerRole={effectiveOwnerRole}
            availableImports={unimportedAssessments.length}
            onLogout={() => void handleLogout()}
          />

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {apiError ? (
              <Card className="mb-6 border-rose-200 bg-rose-50/90 dark:border-rose-900/70 dark:bg-rose-950/30">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="rounded-2xl bg-rose-500/10 p-2 text-rose-600 dark:text-rose-300">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-rose-700 dark:text-rose-200">Error de API</p>
                    <p className="text-sm text-rose-600/90 dark:text-rose-200/80">{apiError}</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <div>{renderContent()}</div>
          </main>
        </div>
      </div>

      <CreateVacancyModal open={isCreateVacancyOpen} onOpenChange={setIsCreateVacancyOpen} onCreate={(payload) => void handleCreateVacancy(payload)} />
      <AddCandidateModal open={isAddCandidateOpen} onOpenChange={setIsAddCandidateOpen} onCreate={(payload) => void handleCreateCandidate(payload)} jobs={jobs} />
      <ScheduleInterviewModal open={isScheduleInterviewOpen} onOpenChange={setIsScheduleInterviewOpen} onCreate={(payload) => void handleScheduleInterview(payload)} candidates={candidates} />
      <ImportAssessmentsModal open={isImportAssessmentsOpen} onOpenChange={setIsImportAssessmentsOpen} assessments={unimportedAssessments} jobs={jobs} onImport={(assessmentId, vacancyId) => void handleImportAssessment(assessmentId, vacancyId)} />
      <CandidateDetailModal
        candidate={selectedCandidate}
        onOpenChange={(next) => !next && setSelectedCandidate(null)}
        onUpdateCandidate={(payload) => void handleUpdateCandidateProgress(payload)}
        isUpdatingCandidate={isUpdatingCandidate}
      />
    </div>
  );
}
