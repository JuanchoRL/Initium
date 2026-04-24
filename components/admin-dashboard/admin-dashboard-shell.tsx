'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  Download,
  FileSpreadsheet,
  FlaskConical,
  ListOrdered,
  LogIn,
  LogOut,
  Search,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ActiveJobsTable } from '@/components/admin-dashboard/active-jobs-table';
import { AddCandidateModal, type AddCandidatePayload } from '@/components/admin-dashboard/add-candidate-modal';
import { AdminSidebar } from '@/components/admin-dashboard/admin-sidebar';
import { AlertsPanel } from '@/components/admin-dashboard/alerts-panel';
import { CandidateDetailModal } from '@/components/admin-dashboard/candidate-detail-modal';
import { CandidateInvitesPanel } from '@/components/admin-dashboard/candidate-invites-panel';
import { CandidateResultsTable } from '@/components/admin-dashboard/candidate-results-table';
import { CreateVacancyModal } from '@/components/admin-dashboard/create-vacancy-modal';
import { EditVacancyModal } from '@/components/admin-dashboard/edit-vacancy-modal';
import { DashboardHeader } from '@/components/admin-dashboard/dashboard-header';
import { FitScoreWidget } from '@/components/admin-dashboard/fit-score-widget';
import { ImportAssessmentsModal } from '@/components/admin-dashboard/import-assessments-modal';
import { InviteCandidateModal, type InviteCandidatePayload } from '@/components/admin-dashboard/invite-candidate-modal';
import { KpiCard } from '@/components/admin-dashboard/kpi-card';
import { PipelineChart } from '@/components/admin-dashboard/pipeline-chart';
import { WorkspaceOnboarding } from '@/components/admin-dashboard/workspace-onboarding';
import { TeamChemistryModal } from '@/components/admin-dashboard/team-chemistry-modal';
import { Avatar } from '@/components/ui/avatar';
import {
  createAdminCandidate,
  createAdminInvite,
  createAdminJob,
  endRecruiterAccess,
  fetchRecruiterAudit,
  fetchAdminAssessmentResults,
  fetchAdminWorkspace,
  recordRecruiterActivity,
  saveAdminWorkspaceSettings,
  updateAdminCandidate,
  updateAdminJob,
} from '@/lib/admin-dashboard/api';
import {
  clearRecruiterAccessSession,
  readRecruiterAccessSession,
  type RecruiterAccessSession,
} from '@/lib/admin-dashboard/recruiter-session';
import { adminNavItems } from '@/lib/admin-dashboard/mock-data';
import {
  buildCandidateDecision,
  describeComparisonLead,
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
  AssessmentInvite,
  CandidateFitScores,
  CandidatePipelineStage,
  CandidateResult,
  CandidateStatus,
  FilterOption,
  FitScoreCategory,
  JobOpening,
  JobStatus,
  JobOpeningWithStats,
  KpiMetric,
  NavItem,
  PipelineStage,
  RecruiterAuditBundle,
  RecruiterAuditEvent,
  RecruiterAuditSession,
  ReportCard,
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
  invites: {
    title: 'Invita a candidatos',
    description: 'Gestiona envíos de evaluación, vigencia del enlace y seguimiento operativo por vacante.',
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

function normalizeForSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesSearch(query: string, values: string[]) {
  const normalized = normalizeForSearch(query);
  if (!normalized) return true;
  return values.some((value) => normalizeForSearch(value).includes(normalized));
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
  invites,
}: {
  candidates: CandidateResult[];
  jobs: JobOpening[];
  invites: AssessmentInvite[];
}): NavItem[] {
  return adminNavItems.map((item) => {
    if (item.key === 'candidates') return { ...item, badge: candidates.length };
    if (item.key === 'jobs') return { ...item, badge: jobs.filter((job) => job.status === 'active').length };
    if (item.key === 'invites') return { ...item, badge: invites.filter((invite) => invite.status === 'sent').length };
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

function ExecutivePulseCard({
  title,
  value,
  note,
  icon: Icon,
  tone = 'cyan',
}: {
  title: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone?: 'cyan' | 'emerald' | 'amber' | 'slate';
}) {
  const toneMap = {
    cyan: {
      surface: 'border-cyan-100 bg-white/90',
      icon: 'bg-cyan-50 text-cyan-700',
      label: 'text-cyan-700',
    },
    emerald: {
      surface: 'border-emerald-100 bg-white/90',
      icon: 'bg-emerald-50 text-emerald-700',
      label: 'text-emerald-700',
    },
    amber: {
      surface: 'border-amber-100 bg-white/90',
      icon: 'bg-amber-50 text-amber-700',
      label: 'text-amber-700',
    },
    slate: {
      surface: 'border-slate-200 bg-white/90',
      icon: 'bg-slate-100 text-slate-700',
      label: 'text-slate-500',
    },
  } as const;

  const palette = toneMap[tone];

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${palette.surface}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${palette.label}`}>{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{note}</p>
        </div>
        <div className={`rounded-2xl p-3 shadow-sm ${palette.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SearchResultsPanel({
  query,
  candidates,
  jobs,
  invites,
  recruiters,
  onClear,
}: {
  query: string;
  candidates: CandidateResult[];
  jobs: JobOpening[];
  invites: AssessmentInvite[];
  recruiters: string[];
  onClear: () => void;
}) {
  const sections = [
    {
      title: 'Candidatos',
      count: candidates.length,
      items: candidates.slice(0, 3).map((candidate) => ({
        id: candidate.id,
        primary: candidate.name,
        secondary: candidate.vacancy,
      })),
    },
    {
      title: 'Vacantes',
      count: jobs.length,
      items: jobs.slice(0, 3).map((job) => ({
        id: job.id,
        primary: job.title,
        secondary: job.department,
      })),
    },
    {
      title: 'Invitaciones',
      count: invites.length,
      items: invites.slice(0, 3).map((invite) => ({
        id: invite.id,
        primary: invite.candidateName,
        secondary: `${invite.vacancy} · vence ${formatDateTime(invite.expiresAt)}`,
      })),
    },
    {
      title: 'Recruiters',
      count: recruiters.length,
      items: recruiters.slice(0, 3).map((recruiter) => ({
        id: recruiter,
        primary: recruiter,
        secondary: 'Coincidencia por responsable del workspace o vacante',
      })),
    },
  ];

  const totalMatches = sections.reduce((total, section) => total + section.count, 0);

  return (
    <Card className="mb-6 overflow-hidden border-cyan-100 bg-white shadow-[0_18px_42px_-30px_rgba(6,182,212,0.25)]">
      <CardHeader className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50/90 via-white to-white pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-cyan-700">
              <Search className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Búsqueda global</span>
            </div>
            <div>
              <CardTitle className="text-slate-950">Resultados para “{query}”</CardTitle>
              <CardDescription className="text-slate-600">
                {totalMatches > 0
                  ? `Encontramos ${totalMatches} coincidencia${totalMatches === 1 ? '' : 's'} entre candidatos, vacantes, invitaciones y recruiters.`
                  : 'No encontramos coincidencias visibles con esa búsqueda.'}
              </CardDescription>
            </div>
          </div>

          <Button variant="outline" className="border-slate-200 text-slate-700" onClick={onClear}>
            <X className="h-4 w-4" />
            Limpiar búsqueda
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{section.title}</p>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {section.count}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {section.items.length ? (
                section.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/80 bg-white px-3 py-3 shadow-sm">
                    <p className="text-sm font-medium text-slate-950">{item.primary}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.secondary}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-3 py-4 text-sm text-slate-500">
                  Sin coincidencias en esta categoría.
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardExecutiveHero({
  ownerName,
  workspaceName,
  candidateCount,
  readyNow,
  pendingActions,
  nextInviteLabel,
  nextInviteCandidate,
  activeShortlistCount,
  bottleneckLabel,
  bottleneckCount,
  alertsCount,
  importsPending,
  topCandidateName,
  topCandidateStep,
}: {
  ownerName: string;
  workspaceName: string;
  candidateCount: number;
  readyNow: number;
  pendingActions: number;
  nextInviteLabel: string;
  nextInviteCandidate: string;
  activeShortlistCount: number;
  bottleneckLabel: string;
  bottleneckCount: number;
  alertsCount: number;
  importsPending: number;
  topCandidateName: string;
  topCandidateStep: string;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
      <Card className="overflow-hidden border-cyan-100/90 bg-white shadow-[0_24px_60px_-36px_rgba(6,182,212,0.28)]">
        <CardContent className="p-0">
          <div className="border-b border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-white px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Executive workspace
              </div>
              <Badge variant="outline">{workspaceName}</Badge>
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="text-[1.85rem] font-semibold tracking-tight text-slate-950 sm:text-[2.15rem]">Buen día, {ownerName}</h2>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                El workspace ya está listo para operar. Hoy tienes {candidateCount} perfiles visibles, {readyNow} listos para mover y {pendingActions} decisión(es) que conviene cerrar antes de abrir nuevas etapas.
              </p>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 2xl:grid-cols-4 sm:px-6">
            <ExecutivePulseCard
              title="Listos para mover"
              value={String(readyNow)}
              note={readyNow ? 'Perfiles con lectura suficiente para avanzar hoy.' : 'Aún no hay perfiles con señal completa para mover.'}
              icon={Target}
              tone="cyan"
            />
            <ExecutivePulseCard
              title="Invitación próxima"
              value={nextInviteLabel}
              note={nextInviteCandidate || 'Sin enlaces con vencimiento inmediato.'}
              icon={Clock3}
              tone="emerald"
            />
            <ExecutivePulseCard
              title="Shortlist activa"
              value={String(activeShortlistCount)}
              note={activeShortlistCount ? 'Perfiles ya fijados en prioridad manual por vacante.' : 'Todavía no hay shortlist consolidada.'}
              icon={ListOrdered}
              tone="slate"
            />
            <ExecutivePulseCard
              title="Decisiones abiertas"
              value={String(pendingActions)}
              note="Incluye revisión recruiter e imports que todavía requieren supervisión."
              icon={AlertTriangle}
              tone="amber"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Card className="border-slate-200/90 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-cyan-700">
              <ClipboardCheck className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Foco del día</span>
            </div>
            <CardTitle className="text-slate-950">{topCandidateName}</CardTitle>
            <CardDescription className="text-slate-600">Perfil con mejor prioridad operativa dentro de la lectura actual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Siguiente paso recomendado</p>
              <p className="mt-2 leading-relaxed">{topCandidateStep}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bottleneck pipeline</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{bottleneckLabel}</p>
                <p className="mt-1 text-sm text-slate-500">{bottleneckCount} perfil(es) visibles</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Imports pendientes</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{importsPending}</p>
                <p className="mt-1 text-sm text-slate-500">{importsPending ? 'Quedan resultados para revisar.' : 'Sin pendientes de sincronización.'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock3 className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Lectura operativa</span>
            </div>
            <CardTitle className="text-slate-950">Agenda + presión del workspace</CardTitle>
            <CardDescription className="text-slate-600">Una lectura rápida para saber dónde conviene entrar primero.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Próximo vencimiento</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{nextInviteLabel}</p>
              <p className="mt-1 text-sm text-slate-600">{nextInviteCandidate || 'No hay invitaciones activas por vencer.'}</p>
            </div>
            <div className="rounded-[22px] border border-amber-100 bg-amber-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Alertas visibles</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{alertsCount}</p>
              <p className="mt-1 text-sm text-slate-600">{alertsCount ? 'Conviene revisar desvíos del funnel y agenda.' : 'No aparecen alertas operativas fuertes.'}</p>
            </div>
            <div className="rounded-[22px] border border-cyan-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Momento recruiter</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {readyNow > pendingActions ? 'Momento de avance' : pendingActions > 0 ? 'Momento de contraste' : 'Operación estable'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {readyNow > pendingActions
                  ? 'La señal está madura para mover pipeline y comité.'
                  : pendingActions > 0
                    ? 'Conviene cerrar decisiones abiertas antes de acelerar.'
                    : 'El workspace está equilibrado para seguir operando sin fricción.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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

  const readyToMove = candidates.filter((candidate) => buildCandidateDecision(candidate).decision === 'advance').length;
  const needsContrast = candidates.filter((candidate) => buildCandidateDecision(candidate).decision === 'review').length;
  const shortlisted = candidates.filter((candidate) => candidate.shortlistManual).length;
  const averageReadiness = Math.round(
    candidates.reduce((total, candidate) => total + buildCandidateDecision(candidate).readinessScore, 0) / candidates.length
  );

  return (
    <Card className="overflow-hidden border-slate-200/90 bg-white shadow-[0_18px_45px_-28px_rgba(14,165,233,0.35)]">
      <CardHeader>
        <div className="space-y-4">
          <div className="rounded-[28px] border border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-cyan-700">
                  <Target className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Command center recruiter</span>
                </div>
                <CardTitle className="text-slate-950">Mesa de decisión</CardTitle>
                <CardDescription className="max-w-3xl text-slate-600">
                  Prioriza a quién mover ahora, quién necesita validación breve y qué señal conviene contrastar antes de tocar el pipeline.
                </CardDescription>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-cyan-100 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Avanzar hoy</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{readyToMove}</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Revisar</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{needsContrast}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Shortlist</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{shortlisted}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Readiness medio</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{averageReadiness}/100</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        {candidates.map((candidate) => {
          const decision = buildCandidateDecision(candidate);
          const meta = getRecruiterDecisionMeta(decision.decision);
          const recommendationMeta = getVacancyRecommendationMeta(decision.recommendation);
          const isShortlisted = Boolean(candidate.shortlistManual);
          const readinessTone =
            decision.readinessScore >= 78
              ? 'bg-emerald-500'
              : decision.readinessScore >= 60
                ? 'bg-amber-500'
                : 'bg-rose-500';
          return (
            <div key={candidate.id} className="rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.45)]">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_300px]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[22px] border border-cyan-100 bg-cyan-50 text-cyan-700 shadow-sm">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">R</span>
                      <span className="text-lg font-semibold leading-none">{decision.readinessScore}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-950">{candidate.name}</p>
                        <Badge className={meta.badgeClass}>{decision.shortLabel}</Badge>
                        <Badge className={recommendationMeta.badgeClass}>{recommendationMeta.shortLabel}</Badge>
                        {isShortlisted ? (
                          <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                            {candidate.shortlistOrder ? `#${candidate.shortlistOrder} shortlist` : 'En shortlist'}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{candidate.vacancy}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-right shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Siguiente paso</p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800">{decision.nextStep}</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Readiness recruiter</p>
                      <span className="text-sm font-semibold text-slate-900">{decision.readinessScore}/100</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${readinessTone}`} style={{ width: `${decision.readinessScore}%` }} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-950">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Fortaleza guía</p>
                      </div>
                      <p className="mt-2 leading-relaxed">{decision.strengths[0] || 'Aún no aparece una fortaleza dominante clara.'}</p>
                    </div>
                    <div className="rounded-[22px] border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-950">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Riesgo a validar</p>
                      </div>
                      <p className="mt-2 leading-relaxed">{decision.risks[0] || 'No surge un riesgo crítico en esta lectura.'}</p>
                    </div>
                    <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-800">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-cyan-700" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Focus entrevista</p>
                      </div>
                      <p className="mt-2 leading-relaxed">{decision.prompts[0]?.question || 'Validación general del caso y consistencia del criterio.'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-full flex-col justify-between gap-4 rounded-[26px] border border-slate-200 bg-slate-50/80 p-5">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Acción recruiter</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{decision.rationale}</p>
                    </div>
                    <div className="grid gap-2">
                      <Button
                        size="sm"
                        variant={isShortlisted ? 'outline' : 'default'}
                        className={isShortlisted ? 'w-full border-slate-200 text-slate-700' : 'w-full bg-cyan-600 text-white hover:bg-cyan-500'}
                        onClick={() => onToggleShortlistCandidate(candidate)}
                      >
                        {isShortlisted ? 'Quitar shortlist' : 'Guardar shortlist'}
                      </Button>
                      {decision.shortlistEligible && !isShortlisted ? (
                        <Button size="sm" className="w-full bg-slate-900 text-white hover:bg-slate-800" onClick={() => onShortlistCandidate(candidate)}>
                          Priorizar ahora
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" className="w-full text-cyan-700 hover:bg-cyan-50" onClick={() => onViewCandidate(candidate)}>
                        Ver ficha táctica
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Lectura rápida</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {isShortlisted
                        ? candidate.shortlistOrder
                          ? `Ya ocupa la posición #${candidate.shortlistOrder} dentro de la shortlist final para esta vacante.`
                          : 'Ya está en shortlist y puede ordenarse en la lista final de la vacante.'
                        : 'Todavía no está guardado en shortlist; conviene hacerlo si el contraste final acompaña.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ShortlistVacancyCard({
  jobs,
  selectedVacancyId,
  onSelectVacancy,
  candidates,
  onMoveCandidate,
  onViewCandidate,
  onToggleShortlistCandidate,
}: {
  jobs: { id: string; title: string; count: number }[];
  selectedVacancyId: string;
  onSelectVacancy: (vacancyId: string) => void;
  candidates: CandidateResult[];
  onMoveCandidate: (candidate: CandidateResult, direction: 'up' | 'down') => void;
  onViewCandidate: (candidate: CandidateResult) => void;
  onToggleShortlistCandidate: (candidate: CandidateResult) => void;
}) {
  const activeJob = jobs.find((job) => job.id === selectedVacancyId) ?? null;
  const leadCandidate = candidates[0] ?? null;
  const remainingCandidates = candidates.slice(1);
  const leadDecision = leadCandidate ? buildCandidateDecision(leadCandidate) : null;
  const averageReadiness = candidates.length
    ? Math.round(candidates.reduce((sum, candidate) => sum + buildCandidateDecision(candidate).readinessScore, 0) / candidates.length)
    : 0;

  return (
    <Card className="border-slate-200/90 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
      <CardHeader className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
              <ListOrdered className="h-3.5 w-3.5" />
              Shortlist final por vacante
            </div>
            <div>
              <CardTitle className="text-[1.45rem] tracking-tight text-slate-950">Prioridad final para comité recruiter</CardTitle>
              <CardDescription className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Ranking manual persistente para cerrar la vacante. El primer perfil se trata como prioridad operativa actual y el resto queda ordenado para comité.
              </CardDescription>
            </div>
          </div>

          <div className="min-w-[260px] max-w-sm flex-1 rounded-[28px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-white p-4 shadow-sm">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Vacante activa</label>
            <select
              value={selectedVacancyId}
              onChange={(event) => onSelectVacancy(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} ({job.count})
                </option>
              ))}
            </select>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Perfiles</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{candidates.length}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Readiness medio</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{averageReadiness || '--'}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Top 1 actual</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{leadCandidate?.name || 'Pendiente'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Vacante</p>
            <p className="mt-2 text-base font-semibold text-slate-950">{activeJob?.title || 'Sin vacante activa'}</p>
          </div>
          <div className="rounded-[24px] border border-cyan-200 bg-cyan-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Lectura comité</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-800">
              {leadCandidate ? `El ranking ya tiene una prioridad operativa clara y ${remainingCandidates.length} alternativa(s) ordenada(s).` : 'Todavía no hay perfiles fijados para la shortlist final de esta vacante.'}
            </p>
          </div>
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Uso recomendado</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-800">Utiliza este orden para comité, coordinación con hiring manager y cierre de agenda de entrevistas.</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {candidates.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm leading-relaxed text-slate-500">
            Aún no hay candidatos en shortlist para esta vacante. Guarda perfiles desde la Mesa de decisión o desde la tabla de candidatos para empezar el ranking final.
          </div>
        ) : (
          <>
            {leadCandidate && leadDecision ? (
              <div className="rounded-[30px] border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-white p-5 shadow-[0_24px_60px_-42px_rgba(6,182,212,0.45)]">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_320px]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[22px] border border-cyan-200 bg-white text-cyan-700 shadow-sm">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">#1</span>
                        <Target className="mt-1 h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xl font-semibold tracking-tight text-slate-950">{leadCandidate.name}</p>
                          <Badge className={getVacancyRecommendationMeta(leadCandidate.vacancyRecommendation ?? leadDecision.recommendation).badgeClass}>
                            {getVacancyRecommendationMeta(leadCandidate.vacancyRecommendation ?? leadDecision.recommendation).label}
                          </Badge>
                          <Badge className="border-cyan-200 bg-white text-cyan-700">Prioridad operativa</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{leadCandidate.vacancy}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Readiness</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{leadDecision.readinessScore}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Etapa actual</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{leadCandidate.pipelineStage}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Siguiente paso</p>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-950">{leadDecision.nextStep}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-950">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Fortaleza guía</p>
                        <p className="mt-2 leading-relaxed">{leadDecision.strengths[0] || 'Sin fortaleza dominante clara todavía.'}</p>
                      </div>
                      <div className="rounded-[22px] border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-950">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Riesgo a validar</p>
                        <p className="mt-2 leading-relaxed">{leadDecision.risks[0] || 'Sin riesgo crítico visible en esta lectura.'}</p>
                      </div>
                      <div className="rounded-[22px] border border-cyan-100 bg-white/90 p-4 text-sm text-slate-800">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Lectura recruiter</p>
                        <p className="mt-2 leading-relaxed">Este es el perfil que hoy conviene mover primero si la vacante exige una decisión corta y operativa.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-full flex-col justify-between gap-4 rounded-[26px] border border-cyan-100 bg-white/90 p-4 shadow-sm">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Decisión base</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">{leadDecision.rationale}</p>
                      </div>
                      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Estado shortlist</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">Ocupando la posición #1 para esta vacante. Si cambian prioridades, reordena desde esta cola final.</p>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Button className="w-full bg-cyan-600 text-white hover:bg-cyan-500" onClick={() => onViewCandidate(leadCandidate)}>
                        Abrir ficha prioritaria
                      </Button>
                      <Button variant="outline" className="w-full border-slate-200 text-slate-700" onClick={() => onToggleShortlistCandidate(leadCandidate)}>
                        Quitar de shortlist
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {remainingCandidates.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Cola de prioridad</p>
                    <p className="text-sm text-slate-500">Alternativas ordenadas para comité, reserva o reemplazo del top actual.</p>
                  </div>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700">{remainingCandidates.length} perfil(es) en espera</Badge>
                </div>
                <div className="grid gap-3">
                  {remainingCandidates.map((candidate, offset) => {
                    const decision = buildCandidateDecision(candidate);
                    const recommendationMeta = getVacancyRecommendationMeta(candidate.vacancyRecommendation ?? decision.recommendation);
                    const absoluteIndex = offset + 1;
                    return (
                      <div key={candidate.id} className="rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.35)]">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                              #{absoluteIndex + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-slate-950">{candidate.name}</p>
                                <Badge className={recommendationMeta.badgeClass}>{recommendationMeta.shortLabel}</Badge>
                                <Badge className="border-slate-200 bg-slate-50 text-slate-700">Readiness {decision.readinessScore}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-slate-500">{candidate.pipelineStage}</p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-700">{decision.nextStep}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <Button
                              variant="outline"
                              size="icon"
                              className="border-slate-200 text-slate-600"
                              disabled={absoluteIndex === 1}
                              onClick={() => onMoveCandidate(candidate, 'up')}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="border-slate-200 text-slate-600"
                              disabled={absoluteIndex === candidates.length - 1}
                              onClick={() => onMoveCandidate(candidate, 'down')}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-cyan-700 hover:bg-cyan-50" onClick={() => onViewCandidate(candidate)}>
                              Abrir ficha
                            </Button>
                            <Button variant="outline" size="sm" className="border-slate-200 text-slate-700" onClick={() => onToggleShortlistCandidate(candidate)}>
                              Quitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
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

  const decoratedCandidates = candidates.map((candidate) => ({
    candidate,
    decision: buildCandidateDecision(candidate),
  }));

  const topScoreId = [...decoratedCandidates].sort((left, right) => (right.candidate.totalScore ?? 0) - (left.candidate.totalScore ?? 0))[0]?.candidate.id;
  const shortlistedCount = decoratedCandidates.filter(({ candidate }) => Boolean(candidate.shortlistManual)).length;
  const currentLeader = decoratedCandidates.find(({ candidate }) => candidate.id === topScoreId)?.candidate ?? decoratedCandidates[0].candidate;

  const COMPARE_DIMS = [
    ['Memoria', 'memory'],
    ['Gestión', 'leadership'],
    ['Crisis', 'problemSolving'],
    ['Ética', 'ethics'],
    ['Riesgo', 'risk'],
    ['Multitarea', 'network'],
    ['Estrategia', 'strategy'],
  ] as const;

  // Find the leader for each dimension
  const dimLeaders = COMPARE_DIMS.reduce((acc, [, key]) => {
    const best = [...decoratedCandidates].sort((a, b) => (b.candidate.rawScores?.[key] ?? 0) - (a.candidate.rawScores?.[key] ?? 0))[0];
    if (best) acc[key] = best.candidate.id;
    return acc;
  }, {} as Record<string, string>);

  return (
    <Card className="border-slate-200/90 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
              <BarChart3 className="h-3.5 w-3.5" />
              Comparación rápida
            </div>
            <div>
              <CardTitle className="text-[1.45rem] tracking-tight text-slate-950">Lectura comparativa para mover primero</CardTitle>
              <CardDescription className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Contrasta a los perfiles líderes sin abrir cada ficha. Aquí debería quedar claro quién toma la delantera y qué señal conviene validar antes de decidir.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Badge variant="outline">{decoratedCandidates.length} comparados</Badge>
            <Badge variant="outline">Lidera {currentLeader.name}</Badge>
            <Badge variant="outline">{shortlistedCount} en shortlist</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {decoratedCandidates.map(({ candidate, decision }) => {
            const meta = getRecruiterDecisionMeta(decision.decision);
            const recommendationMeta = getVacancyRecommendationMeta(decision.recommendation);
            const isShortlisted = Boolean(candidate.shortlistManual);
            const leadBadges: string[] = [];
            if (candidate.id === topScoreId) leadBadges.push('Líder score');
            const dimWins = Object.entries(dimLeaders).filter(([, id]) => id === candidate.id);
            if (dimWins.length >= 3) leadBadges.push(`Líder en ${dimWins.length} dimensiones`);

            return (
              <div key={candidate.id} className="flex h-full flex-col rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_20px_48px_-36px_rgba(15,23,42,0.4)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-slate-950">{candidate.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{candidate.vacancy}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-cyan-700 hover:bg-cyan-50" onClick={() => onViewCandidate(candidate)}>
                    Abrir ficha
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge className={meta.badgeClass}>{decision.label}</Badge>
                  <Badge className={recommendationMeta.badgeClass}>{recommendationMeta.label}</Badge>
                  {isShortlisted ? (
                    <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">
                      {candidate.shortlistOrder ? `#${candidate.shortlistOrder} shortlist` : 'En shortlist'}
                    </Badge>
                  ) : null}
                  {leadBadges.map((badge) => (
                    <Badge key={badge} className="border-slate-200 bg-slate-50 text-slate-700">
                      {badge}
                    </Badge>
                  ))}
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600">{describeComparisonLead(candidate, candidates.filter((peer) => peer.id !== candidate.id))}</p>

                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">Score global</p>
                  <div className="flex items-baseline gap-2 mb-4">
                    <p className="font-[family:var(--font-admin-mono)] text-3xl font-bold text-slate-950">{candidate.totalScore ?? '--'}</p>
                    <p className="text-sm text-slate-400">/ 100</p>
                  </div>
                  {candidate.rawScores ? (
                    <div className="space-y-2">
                      {COMPARE_DIMS.map(([label, key]) => {
                        const val = candidate.rawScores?.[key] ?? 0;
                        const isLeader = dimLeaders[key] === candidate.id && decoratedCandidates.length > 1;
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className={`w-[72px] text-[11px] font-medium shrink-0 ${isLeader ? 'text-cyan-700 font-bold' : 'text-slate-500'}`}>{label}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${val >= 70 ? 'bg-cyan-500' : val >= 45 ? 'bg-slate-400' : 'bg-amber-400'}`}
                                style={{ width: `${Math.min(val, 100)}%` }}
                              />
                            </div>
                            <span className={`font-[family:var(--font-admin-mono)] text-xs w-8 text-right ${isLeader ? 'text-cyan-700 font-bold' : 'text-slate-500'}`}>{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Sin dimensiones detalladas disponibles.</p>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-950">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Fortaleza guía</p>
                    <p className="mt-2 leading-relaxed">{decision.strengths[0] || 'Sin fortaleza dominante clara todavía.'}</p>
                  </div>
                  <div className="rounded-[22px] border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-950">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Riesgo a validar</p>
                    <p className="mt-2 leading-relaxed">{decision.risks[0] || 'Sin riesgo crítico visible en esta lectura.'}</p>
                  </div>
                  <div className="rounded-[22px] border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-800">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Foco táctico</p>
                    <p className="mt-2 leading-relaxed">{decision.prompts[0]?.question || 'Validación general en entrevista.'}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                    {isShortlisted
                      ? candidate.shortlistOrder
                        ? `En shortlist con prioridad #${candidate.shortlistOrder}.`
                        : 'Ya está guardado en shortlist.'
                      : 'Aún no está en shortlist manual.'}
                  </div>
                  <div className="grid gap-2">
                  <Button
                    size="sm"
                    variant={isShortlisted ? 'outline' : 'default'}
                    className={isShortlisted ? 'w-full border-slate-200 text-slate-700' : 'w-full bg-cyan-600 text-white hover:bg-cyan-500'}
                    onClick={() => onToggleShortlistCandidate(candidate)}
                  >
                    {isShortlisted ? 'Quitar shortlist' : 'Guardar shortlist'}
                  </Button>
                  </div>
                </div>
              </div>
            );
          })}
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
  if (action === 'send-invite') return 'text-amber-700 bg-amber-50 border-amber-200';
  if (action === 'create-candidate') return 'text-sky-700 bg-sky-50 border-sky-200';
  if (action === 'update-candidate-status') return 'text-violet-700 bg-violet-50 border-violet-200';
  if (action === 'shortlist-candidate' || action === 'unshortlist-candidate') return 'text-cyan-700 bg-cyan-50 border-cyan-200';
  if (action === 'reorder-shortlist') return 'text-cyan-700 bg-cyan-50 border-cyan-200';
  if (action === 'set-vacancy-recommendation') return 'text-teal-700 bg-teal-50 border-teal-200';
  if (action === 'update-workspace') return 'text-slate-700 bg-slate-100 border-slate-200';
  return 'text-slate-700 bg-slate-50 border-slate-200';
}

function getActivityIcon(action: string) {
  if (action === 'create-job') return BriefcaseBusiness;
  if (action === 'import-assessment') return ClipboardCheck;
  if (action === 'send-invite') return Send;
  if (action === 'create-candidate') return UsersRound;
  if (action === 'update-candidate-status') return Sparkles;
  if (action === 'shortlist-candidate' || action === 'unshortlist-candidate') return ShieldCheck;
  if (action === 'reorder-shortlist') return ListOrdered;
  if (action === 'set-vacancy-recommendation') return Sparkles;
  if (action === 'update-workspace') return Save;
  return Activity;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'create-job': 'Crear vacante',
  'import-assessment': 'Vincular resultado manual',
  'send-invite': 'Enviar evaluación',
  'create-candidate': 'Crear candidato',
  'update-candidate-status': 'Cambiar estado',
  'shortlist-candidate': 'Guardar shortlist',
  'unshortlist-candidate': 'Quitar shortlist',
  'reorder-shortlist': 'Reordenar shortlist',
  'set-vacancy-recommendation': 'Definir recomendación',
  'update-workspace': 'Editar workspace',
};

function formatAuditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function AdminDashboardShell() {
  const router = useRouter();
  const params = useParams();
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterValue, setFilterValue] = useState('all');
  const [shortlistVacancyId, setShortlistVacancyId] = useState<string>('all');
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
  const [jobToEdit, setJobToEdit] = useState<JobOpeningWithStats | null>(null);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [isImportAssessmentsOpen, setIsImportAssessmentsOpen] = useState(false);
  const [isInviteCandidateOpen, setIsInviteCandidateOpen] = useState(false);
  const [isTeamChemistryOpen, setIsTeamChemistryOpen] = useState(false);
  const [jobStatusFilter, setJobStatusFilter] = useState<'all' | 'active-only'>('active-only');

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

    const locale = params?.locale || 'es';
    router.replace(`/${locale}`);
  }, [recruiterSession, router, params]);

  useEffect(() => {
    if (!isRecruiterAccessValidated) return;

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
  }, [isRecruiterAccessValidated, refreshRecruiterAudit, setErrorFrom]);

  useEffect(() => {
    const session = readRecruiterAccessSession();
    if (!session) {
      const locale = params?.locale || 'es';
      router.replace(`/${locale}`);
      return;
    }
    setRecruiterSession(session);
    setIsRecruiterAccessValidated(true);
  }, [router, params]);

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
  const invites = workspace.invites;
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
  const navItems = useMemo(() => buildNavItems({ candidates, jobs, invites }), [candidates, jobs, invites]);

  const filteredCandidates = useMemo(
    () =>
      candidates
        .filter((candidate) =>
          matchesSearch(searchValue, [
            candidate.name,
            candidate.email,
            candidate.vacancy,
            candidate.department,
            candidate.recruiter,
            candidate.location,
            candidate.strategyProfile ?? '',
            candidate.personalityProfile ?? '',
            candidate.personalitySubtype ?? '',
            effectiveOwnerName,
            effectiveOwnerRole,
          ]) &&
          matchesScope(filterValue, { department: candidate.department, vacancyId: candidate.vacancyId })
        )
        .sort((a, b) => {
          // Primary: newest candidates first (by creation/applied date)
          const dateA = new Date(a.appliedAt).getTime();
          const dateB = new Date(b.appliedAt).getTime();
          if (dateB !== dateA) return dateB - dateA;
          // Secondary: most recently updated first
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    [candidates, effectiveOwnerName, effectiveOwnerRole, filterValue, searchValue]
  );

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => matchesSearch(searchValue, [job.title, job.department, job.owner, job.location]) && matchesScope(filterValue, { department: job.department, id: job.id })),
    [filterValue, jobs, searchValue]
  );

  const filteredInvites = useMemo(
    () =>
      invites.filter((invite) =>
        matchesSearch(searchValue, [
          invite.candidateName,
          invite.candidateEmail,
          invite.candidatePhone ?? '',
          invite.vacancy,
          invite.department,
          invite.recruiter,
        ]) &&
        matchesScope(filterValue, { department: invite.department, vacancyId: invite.vacancyId })
      ),
    [filterValue, invites, searchValue]
  );

  const filteredRecruiters = useMemo(() => {
    const normalizedQuery = normalizeForSearch(searchValue);
    if (!normalizedQuery) return [];

    return Array.from(
      new Set(
        [effectiveOwnerName, effectiveOwnerRole]
          .concat(candidates.map((candidate) => candidate.recruiter))
          .concat(jobs.map((job) => job.owner))
          .concat(invites.map((invite) => invite.recruiter))
          .filter(Boolean)
      )
    ).filter((value) => matchesSearch(normalizedQuery, [value]));
  }, [candidates, effectiveOwnerName, effectiveOwnerRole, invites, jobs, searchValue]);

  const searchSummary = useMemo(() => {
    const normalizedQuery = normalizeForSearch(searchValue);
    if (!normalizedQuery) return null;

    const summaryParts = [
      `${filteredCandidates.length} candidato${filteredCandidates.length === 1 ? '' : 's'}`,
      `${filteredJobs.length} vacante${filteredJobs.length === 1 ? '' : 's'}`,
      `${filteredInvites.length} invitación${filteredInvites.length === 1 ? '' : 'es'}`,
    ];

    if (filteredRecruiters.length) {
      summaryParts.push(`${filteredRecruiters.length} recruiter${filteredRecruiters.length === 1 ? '' : 's'}`);
    }

    const totalMatches = filteredCandidates.length + filteredJobs.length + filteredInvites.length + filteredRecruiters.length;
    if (totalMatches === 0) {
      return `No encontramos coincidencias para “${searchValue.trim()}”.`;
    }

    return `Resultados para “${searchValue.trim()}”: ${summaryParts.join(' · ')}.`;
  }, [filteredCandidates.length, filteredInvites.length, filteredJobs.length, filteredRecruiters.length, searchValue]);

  const nextExpiringInvite = useMemo(
    () =>
      filteredInvites.length
        ? [...filteredInvites].sort((left, right) => new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime())[0]!
        : null,
    [filteredInvites]
  );

  const jobsWithStats = useMemo<JobOpeningWithStats[]>(() => {
    return filteredJobs.map((job) => {
      const jobCandidates = candidates.filter((candidate) => candidate.vacancyId === job.id);
      const jobInvites = invites.filter((invite) => invite.vacancyId === job.id);
      const recommendedCount = jobCandidates.filter((candidate) => buildCandidateDecision(candidate).recommendation === 'recommended').length;
      const reserveCount = jobCandidates.filter((candidate) => buildCandidateDecision(candidate).recommendation === 'reserve').length;
      const noAdvanceCount = jobCandidates.filter((candidate) => buildCandidateDecision(candidate).recommendation === 'no-advance').length;
      return {
        ...job,
        appliedCount: jobCandidates.length,
        assessmentCount: jobCandidates.filter((candidate) => candidate.pipelineStage === 'assessment').length,
        inviteCount: jobInvites.length,
        hiredCount: jobCandidates.filter((candidate) => candidate.pipelineStage === 'hired').length,
        shortlistedCount: jobCandidates.filter((candidate) => Boolean(candidate.shortlistManual)).length,
        recommendedCount,
        reserveCount,
        noAdvanceCount,
      };
    });
  }, [candidates, filteredJobs, invites]);

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
    const candidatesWithRaw = filteredCandidates.filter((candidate) => candidate.rawScores);
    if (!candidatesWithRaw.length) return [];

    return [
      {
        id: 'memory',
        label: 'Memoria',
        value: average(candidatesWithRaw.map((c) => c.rawScores?.memory ?? 0)),
        note: `${candidatesWithRaw.length} perfiles evaluados en retención y reconstrucción de patrones.`,
      },
      {
        id: 'leadership',
        label: 'Gestión',
        value: average(candidatesWithRaw.map((c) => c.rawScores?.leadership ?? 0)),
        note: 'Promedio de asignación, distribución de carga y criterio de equipos.',
      },
      {
        id: 'problemSolving',
        label: 'Crisis',
        value: average(candidatesWithRaw.map((c) => c.rawScores?.problemSolving ?? 0)),
        note: 'Capacidad promedio de respuesta ante escenarios críticos.',
      },
      {
        id: 'ethics',
        label: 'Ética',
        value: average(candidatesWithRaw.map((c) => c.rawScores?.ethics ?? 0)),
        note: 'Consistencia ética bajo presión y dilemas complejos.',
      },
      {
        id: 'risk',
        label: 'Riesgo',
        value: average(candidatesWithRaw.map((c) => c.rawScores?.risk ?? 0)),
        note: 'Control de riesgo e incertidumbre promedio del pool.',
      },
      {
        id: 'network',
        label: 'Multitarea',
        value: average(candidatesWithRaw.map((c) => c.rawScores?.network ?? 0)),
        note: 'Atención dividida y manejo de múltiples frentes simultáneos.',
      },
      {
        id: 'strategy',
        label: 'Estrategia',
        value: average(candidatesWithRaw.map((c) => c.rawScores?.strategy ?? 0)),
        note: 'Priorización estratégica y asignación de recursos.',
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

  const comparisonCandidates = useMemo(() => decisionCandidates.slice(0, 5), [decisionCandidates]);
  const shortlistVacancyOptions = useMemo(() => {
    const options = jobsWithStats
      .filter((job) => job.shortlistedCount > 0 || filteredCandidates.some((candidate) => candidate.vacancyId === job.id))
      .map((job) => ({
        id: job.id,
        title: job.title,
        count: filteredCandidates.filter((candidate) => candidate.vacancyId === job.id && Boolean(candidate.shortlistManual)).length,
      }));

    if (options.length === 0) {
      return filteredJobs.map((job) => ({
        id: job.id,
        title: job.title,
        count: filteredCandidates.filter((candidate) => candidate.vacancyId === job.id && Boolean(candidate.shortlistManual)).length,
      }));
    }

    return options;
  }, [filteredCandidates, filteredJobs, jobsWithStats]);

  useEffect(() => {
    if (!shortlistVacancyOptions.length) {
      if (shortlistVacancyId !== 'all') setShortlistVacancyId('all');
      return;
    }

    if (shortlistVacancyId === 'all' || shortlistVacancyOptions.some((job) => job.id === shortlistVacancyId)) {
      return;
    }

    setShortlistVacancyId(shortlistVacancyOptions[0]?.id ?? 'all');
  }, [shortlistVacancyId, shortlistVacancyOptions]);

  const shortlistCandidatesForVacancy = useMemo(() => {
    const selectedVacancy = shortlistVacancyId === 'all' ? shortlistVacancyOptions[0]?.id : shortlistVacancyId;
    const shortlisted = filteredCandidates.filter(
      (candidate) => Boolean(candidate.shortlistManual) && (!selectedVacancy || candidate.vacancyId === selectedVacancy)
    );
    return [...shortlisted].sort((left, right) => {
      const leftOrder = left.shortlistOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.shortlistOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return (right.totalScore ?? 0) - (left.totalScore ?? 0);
    });
  }, [filteredCandidates, shortlistVacancyId, shortlistVacancyOptions]);

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

    const pendingInvites = invites.filter((invite) => invite.status === 'sent');
    if (pendingInvites.length > 0) {
      nextAlerts.push({
        id: 'pending-invites',
        title: 'Evaluaciones enviadas por vencer',
        description: `${pendingInvites.length} invitaciones siguen activas y conviene revisar su vigencia o completitud.`,
        severity: 'warning',
        meta: 'Invitaciones activas',
        actionLabel: 'Revisar envíos',
      });
    }

    const lowConversionJobs = jobsWithStats.filter((job) => job.appliedCount >= 3 && job.assessmentCount === 0);
    if (lowConversionJobs.length > 0) {
      nextAlerts.push({
        id: 'low-conversion',
        title: 'Vacantes con baja conversión',
        description: `${lowConversionJobs.length} vacantes tienen candidatos aplicados, pero todavía no muestran suficiente evaluación completada.`,
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
        description: `${standoutCandidates.length} perfiles superan 85/100 y pueden priorizarse en shortlist o revisión final.`,
        severity: 'success',
        meta: 'Scores altos',
        actionLabel: 'Abrir candidatos',
      });
    }

    return nextAlerts;
  }, [candidates, invites, jobsWithStats, unimportedAssessments.length]);

  const reportCards = useMemo<ReportCard[]>(() => {
    const candidatesWithScores = candidates.filter((candidate) => candidate.totalScore != null);
    const scoreCoverage = candidates.length > 0 ? Math.round((candidatesWithScores.length / candidates.length) * 100) : 0;
    const assessmentStageCandidates = candidates.filter((candidate) => ['assessment', 'final-review', 'hired'].includes(candidate.pipelineStage));
    const reviewReady = candidates.filter((candidate) => ['final-review', 'hired'].includes(candidate.pipelineStage));
    const advancementRate = assessmentStageCandidates.length > 0 ? Math.round((reviewReady.length / assessmentStageCandidates.length) * 100) : 0;
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
        title: 'Assessment → Revisión final',
        value: `${advancementRate}%`,
        delta: `${reviewReady.length} candidatos`,
        description: 'Tasa real de avance desde evaluación hacia revisión final.',
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

    const inviteDates = countByPeriod(invites.map((invite) => invite.createdAt));
    const activeJobs = jobs.filter((job) => job.status === 'active').length;
    const jobDates = countByPeriod(jobs.map((job) => job.postedAt));

    const assessmentStageCandidates = candidates.filter((candidate) => ['assessment', 'final-review', 'hired'].includes(candidate.pipelineStage));
    const reviewStageCandidates = candidates.filter((candidate) => ['final-review', 'hired'].includes(candidate.pipelineStage));
    const advancementValue = assessmentStageCandidates.length > 0 ? Math.round((reviewStageCandidates.length / assessmentStageCandidates.length) * 100) : 0;

    const currentAssessmentWindow = candidates.filter((candidate) => new Date(candidate.updatedAt) >= daysAgo(30) && ['assessment', 'final-review', 'hired'].includes(candidate.pipelineStage)).length;
    const previousAssessmentWindow = candidates.filter((candidate) => {
      const date = new Date(candidate.updatedAt);
      return date >= daysAgo(60) && date < daysAgo(30) && ['assessment', 'final-review', 'hired'].includes(candidate.pipelineStage);
    }).length;
    const currentReviewWindow = candidates.filter((candidate) => new Date(candidate.updatedAt) >= daysAgo(30) && ['final-review', 'hired'].includes(candidate.pipelineStage)).length;
    const previousReviewWindow = candidates.filter((candidate) => {
      const date = new Date(candidate.updatedAt);
      return date >= daysAgo(60) && date < daysAgo(30) && ['final-review', 'hired'].includes(candidate.pipelineStage);
    }).length;
    const advancementDelta = calculateDelta(currentReviewWindow, previousReviewWindow || previousAssessmentWindow);

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
        id: 'invites',
        title: 'Invitaciones enviadas',
        value: String(invites.length),
        delta: calculateDelta(inviteDates.current, inviteDates.previous),
        improvesWhen: 'higher',
        icon: Send,
        caption: 'enlaces activos o completados',
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
        caption: 'de evaluación a revisión final',
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
  }, [candidates, invites, jobs]);

  const handleCreateVacancy = async ({
    title,
    department,
    location,
    scoreProfileId,
    jobDescription,
  }: {
    title: string;
    department: string;
    location: string;
    scoreProfileId: VacancyScoreProfileId;
    jobDescription: string;
  }) => {
    try {
      const response = await createAdminJob({
        title,
        department,
        location,
        owner: effectiveOwnerName,
        scoreProfileId,
        jobDescription,
      });
      applyWorkspace(response.workspace);
      await logRecruiterActivity({
        action: 'create-job',
        entityType: 'job',
        summary: `Creó la vacante ${title}`,
        details: `Área: ${department}. Ubicación: ${location}.${jobDescription.trim() ? ' Job description cargada.' : ''}`,
      });
      setApiError(null);
      setActiveView('jobs');
      setFilterValue('all');
    } catch (error) {
      setErrorFrom(error, 'No se pudo crear la vacante');
    }
  };

  const handleUpdateVacancyModal = async (payload: {
    id: string;
    title: string;
    department: string;
    location: string;
    scoreProfileId: VacancyScoreProfileId;
    jobDescription: string;
    status: JobStatus;
  }) => {
    try {
      const response = await updateAdminJob(payload);
      setWorkspace(response.workspace);
      void recordRecruiterActivity({
        sessionId: recruiterSession!.sessionId,
        recruiterName: recruiterSession!.name,
        recruiterEmail: recruiterSession!.email,
        action: 'vacancy_updated',
        entityType: 'job',
        entityId: payload.id,
        summary: `Actualizó la vacante ${payload.title}`,
      });
    } catch (err: any) {
      console.error(err);
      alert('Error al actualizar la vacante');
    }
  };

  const handleUpdateJob = async (
    job: JobOpeningWithStats,
    updates: {
      status?: JobStatus;
    },
  ) => {
    try {
      const response = await updateAdminJob({
        id: job.id,
        status: updates.status,
      });
      applyWorkspace(response.workspace);
      if (updates.status && updates.status !== job.status) {
        await logRecruiterActivity({
          action: 'update-job-status',
          entityType: 'job',
          entityId: job.id,
          summary: `Actualizó la vacante ${job.title}`,
          details: `Nuevo estado: ${updates.status}. Estado anterior: ${job.status}.`,
        });
      }
      setApiError(null);
    } catch (error) {
      setErrorFrom(error, 'No se pudo actualizar la vacante');
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
      phone: payload.phone,
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

  const handleCreateInvite = async (payload: InviteCandidatePayload) => {
    const job = jobs.find((item) => item.id === payload.vacancyId);
    if (!job) {
      setApiError('Debes seleccionar una vacante válida');
      return;
    }

    const nextInvite: AssessmentInvite = {
      id: `invite-${crypto.randomUUID()}`,
      candidateName: payload.candidateName,
      candidateEmail: payload.candidateEmail,
      candidatePhone: payload.candidatePhone,
      vacancyId: job.id,
      vacancy: job.title,
      department: job.department,
      recruiter: effectiveOwnerName,
      expiresAt: payload.expiresAt,
      createdAt: new Date().toISOString(),
      status: 'sent',
    };

    try {
      const response = await createAdminInvite(nextInvite);
      applyWorkspace(response.workspace);
      await logRecruiterActivity({
        action: 'send-invite',
        entityType: 'invite',
        entityId: nextInvite.id,
        summary: `Envió evaluación a ${payload.candidateName}`,
        details: `${job.title} · vence ${payload.expiresAt}.`,
      });
      setApiError(null);
      setActiveView('invites');
    } catch (error) {
      setErrorFrom(error, 'No se pudo enviar la invitación');
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
    vacancyId,
    phone,
    recruiterNotes,
    shortlistManual,
    vacancyRecommendation,
    shortlistOrder,
  }: {
    id: string;
    status: CandidateStatus;
    pipelineStage: CandidatePipelineStage;
    vacancyId?: string;
    phone?: string;
    recruiterNotes?: string;
    shortlistManual?: boolean;
    vacancyRecommendation?: VacancyRecommendation;
    shortlistOrder?: number;
  }, auditOverride?: { action?: string; summary?: string; details?: string }) => {
    try {
      setIsUpdatingCandidate(true);
      const currentCandidate = candidates.find((candidate) => candidate.id === id);
      const inferredAction =
        !auditOverride?.action &&
        currentCandidate &&
        currentCandidate.status === status &&
        currentCandidate.pipelineStage === pipelineStage &&
        typeof vacancyId === 'undefined' &&
        typeof phone === 'undefined' &&
        typeof recruiterNotes === 'undefined' &&
        typeof shortlistManual !== 'boolean' &&
        vacancyRecommendation &&
        vacancyRecommendation !== currentCandidate.vacancyRecommendation
          ? 'set-vacancy-recommendation'
          : undefined;
      const response = await updateAdminCandidate({ id, status, pipelineStage, vacancyId, phone, recruiterNotes, shortlistManual, vacancyRecommendation, shortlistOrder });
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
          `${pipelineStage} · ${status}${vacancyId ? ` · vacante ${updatedCandidate?.vacancy || vacancyId}` : ''}${phone ? ' · teléfono actualizado' : ''}${typeof recruiterNotes === 'string' ? ' · notas recruiter' : ''}${typeof shortlistManual === 'boolean' ? ` · shortlist ${shortlistManual ? 'on' : 'off'}` : ''}${vacancyRecommendation ? ` · recomendación ${vacancyRecommendation}` : ''}.`,
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

  const handleReorderShortlistCandidate = async (candidate: CandidateResult, direction: 'up' | 'down') => {
    const vacancyShortlist = filteredCandidates
      .filter((item) => Boolean(item.shortlistManual) && item.vacancyId === candidate.vacancyId)
      .sort((left, right) => {
        const leftOrder = left.shortlistOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.shortlistOrder ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return (right.totalScore ?? 0) - (left.totalScore ?? 0);
      });

    const currentIndex = vacancyShortlist.findIndex((item) => item.id === candidate.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= vacancyShortlist.length) return;

    await handleUpdateCandidateProgress(
      {
        id: candidate.id,
        status: candidate.status,
        pipelineStage: candidate.pipelineStage,
        shortlistManual: true,
        vacancyRecommendation: candidate.vacancyRecommendation,
        shortlistOrder: targetIndex + 1,
      },
      {
        action: 'reorder-shortlist',
        summary: `Reordenó a ${candidate.name} en la shortlist`,
        details: `Vacante ${candidate.vacancy}. Nueva prioridad sugerida: #${targetIndex + 1}.`,
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

      <DashboardExecutiveHero
        ownerName={effectiveOwnerName}
        workspaceName={workspace.organizationName}
        candidateCount={filteredCandidates.length}
        readyNow={recruiterDecisionSummary.advance}
        pendingActions={recruiterDecisionSummary.review + unimportedAssessments.length}
        nextInviteLabel={nextExpiringInvite ? formatDateTime(nextExpiringInvite.expiresAt) : 'Sin vencimientos'}
        nextInviteCandidate={nextExpiringInvite ? nextExpiringInvite.candidateName : ''}
        activeShortlistCount={filteredCandidates.filter((candidate) => Boolean(candidate.shortlistManual)).length}
        bottleneckLabel={[...pipelineStages].sort((left, right) => right.count - left.count)[0]?.label ?? 'Aplicado'}
        bottleneckCount={[...pipelineStages].sort((left, right) => right.count - left.count)[0]?.count ?? 0}
        alertsCount={alerts.length}
        importsPending={unimportedAssessments.length}
        topCandidateName={shortlistSuggestions[0]?.name ?? 'Sin prioridad dominante todavía'}
        topCandidateStep={shortlistSuggestions[0] ? buildCandidateDecision(shortlistSuggestions[0]).nextStep : 'Todavía no hay una prioridad táctica suficientemente clara para mover pipeline.'}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {dynamicKpis.map((metric) => (
          <KpiCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        <PipelineChart stages={pipelineStages} />
        <FitScoreWidget categories={fitCategories} />
      </div>

      <ActiveJobsTable
        jobs={jobsWithStats.filter((j) => j.status !== 'closed')}
        candidates={workspace.candidates}
        allCandidates={workspace.candidates}
        onUpdateJob={(job, updates) => void handleUpdateJob(job, updates)}
        onEditJob={(job) => setJobToEdit(job)}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <CandidateInvitesPanel invites={filteredInvites.slice(0, 4)} />
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );

  const renderCandidatesView = () => (
    <div className="space-y-8">
      <ViewIntro view="candidates" />
      <div className="grid gap-4 md:grid-cols-3">
        <DecisionStatCard title="Avanzar ahora" value={String(recruiterDecisionSummary.advance)} hint="perfil listo para shortlist" decision="advance" icon={Sparkles} />
        <DecisionStatCard title="Revisar" value={String(recruiterDecisionSummary.review)} hint="requiere entrevista breve" decision="review" icon={ClipboardCheck} />
        <DecisionStatCard title="No avanzar" value={String(recruiterDecisionSummary.decline)} hint="riesgo operativo alto" decision="decline" icon={AlertTriangle} />
      </div>
      <CandidateResultsTable
        candidates={filteredCandidates}
        title="Candidatos"
        description="Perfiles ordenados por fecha de ingreso. Los candidatos más recientes aparecen primero."
        showExecutiveHeader
        onViewCandidate={setSelectedCandidate}
        onShortlistCandidate={(candidate) => void handleShortlistCandidate(candidate)}
        onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
      />
      <div className="space-y-3 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Herramientas de decisión</p>
        <h3 className="text-xl font-semibold tracking-tight text-slate-950">Mesa de decisión</h3>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-500">Prioriza a quién mover ahora, qué perfil dejar en revisión y dónde enfocar la siguiente entrevista.</p>
      </div>
      <DecisionQueueCard
        candidates={shortlistSuggestions}
        onViewCandidate={setSelectedCandidate}
        onShortlistCandidate={(candidate) => void handleShortlistCandidate(candidate)}
        onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
      />
      <div className="space-y-3 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Comparación</p>
        <h3 className="text-xl font-semibold tracking-tight text-slate-950">Comparación rápida</h3>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-500">Contrasta líderes y verifica si el ranking se sostiene antes de abrir fichas o mover pipeline.</p>
      </div>
      <CandidateComparisonCard
        candidates={comparisonCandidates}
        onViewCandidate={setSelectedCandidate}
        onToggleShortlistCandidate={(candidate) => void handleToggleShortlistCandidate(candidate)}
      />
    </div>
  );

  const renderJobsView = () => {
    const visibleJobs = jobStatusFilter === 'active-only'
      ? jobsWithStats.filter((j) => j.status !== 'closed')
      : jobsWithStats;

    return (
    <div className="space-y-6">
      <ViewIntro view="jobs" />
      <div className="grid gap-4 md:grid-cols-3">
        <SmallStatCard title="Vacantes activas" value={String(jobs.filter((job) => job.status === 'active').length)} hint="persistidas en DB" icon={BriefcaseBusiness} />
        <SmallStatCard title="On hold" value={String(jobs.filter((job) => job.status === 'on-hold').length)} hint="pausadas por recruiter" icon={Clock3} />
        <SmallStatCard title="Cerradas" value={String(jobs.filter((job) => job.status === 'closed').length)} hint="roles ya cerrados" icon={FileSpreadsheet} />
      </div>
      <div className="flex items-center gap-2">
        <p className="text-xs text-slate-500 mr-2">Mostrar:</p>
        <button
          type="button"
          onClick={() => setJobStatusFilter('active-only')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${jobStatusFilter === 'active-only' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Activas y pendientes
        </button>
        <button
          type="button"
          onClick={() => setJobStatusFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${jobStatusFilter === 'all' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          Todas ({jobsWithStats.length})
        </button>
      </div>
      <ActiveJobsTable
        jobs={visibleJobs}
        candidates={workspace.candidates}
        allCandidates={workspace.candidates}
        onUpdateJob={(job, updates) => void handleUpdateJob(job, updates)}
        onEditJob={(job) => setJobToEdit(job)}
      />
    </div>
    );
  };

  // --- Archetype collapsible group (used in Pipeline view) — glassmorphism style ---
  function ArchetypeGroup({
    archetype,
    members,
    index,
    onViewCandidate,
  }: {
    archetype: string;
    members: CandidateResult[];
    index: number;
    onViewCandidate: (c: CandidateResult) => void;
  }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div className={`rounded-2xl overflow-hidden border transition-all duration-300 ${isOpen ? 'border-cyan-200/80 shadow-[0_8px_32px_-12px_rgba(14,165,233,0.12)]' : 'border-slate-200/60 hover:border-slate-300/80'}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full px-5 py-3.5 bg-white/80 backdrop-blur-sm transition-all hover:bg-slate-50/90 group"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-50 to-slate-100 border border-slate-200/80 shadow-sm">
              <Users className="h-3.5 w-3.5 text-cyan-700" />
            </span>
            <div className="text-left">
              <span className="text-[13px] font-semibold text-slate-800 group-hover:text-slate-950 transition-colors">{archetype}</span>
            </div>
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-slate-100/80 text-slate-600 border border-slate-200/60">
              {members.length}
            </span>
          </div>
          <div className={`h-6 w-6 rounded-lg flex items-center justify-center bg-slate-100/60 border border-slate-200/40 transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </div>
        </button>
        {isOpen && (
          <div className="bg-gradient-to-b from-slate-50/60 to-white px-5 py-3.5 space-y-1.5 border-t border-slate-100/80">
            {members.map((c) => (
              <button
                key={c.id}
                onClick={() => onViewCandidate(c)}
                className="flex items-center justify-between w-full gap-3 rounded-xl bg-white/90 backdrop-blur-sm p-2.5 border border-slate-100/80 hover:border-cyan-200/60 hover:shadow-[0_4px_16px_-6px_rgba(14,165,233,0.1)] transition-all duration-200 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={c.name} size="sm" className="h-7 w-7 text-[10px] shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-800">{c.name}</p>
                    <p className="truncate text-[10px] text-slate-400">{c.vacancy || 'Sin vacante'}{c.personalitySubtype ? ` · ${c.personalitySubtype}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.totalScore != null && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {c.totalScore} <span className="text-slate-400">pts</span>
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const renderPipelineView = () => {
    // Build archetype groups from all workspace candidates
    const archetypeMap: Record<string, typeof workspace.candidates> = {};
    workspace.candidates.forEach((c) => {
      const archetype = c.personalityProfile || '';
      if (!archetype) return;
      if (!archetypeMap[archetype]) archetypeMap[archetype] = [];
      archetypeMap[archetype].push(c);
    });
    const archetypeEntries = Object.entries(archetypeMap).sort((a, b) => b[1].length - a[1].length);

    return (
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

      {/* Team Chemistry Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setIsTeamChemistryOpen(true)}
          variant="outline"
          className="gap-2 border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-300 shadow-sm"
        >
          <FlaskConical className="h-4 w-4" />
          Simulador de Química de Equipo
        </Button>
      </div>

      {/* Archetype Grouping — Glass Design */}
      {archetypeEntries.length > 0 && (
        <Card className="overflow-hidden border-slate-200/80 shadow-[0_18px_40px_-28px_rgba(14,165,233,0.15)]">
          <CardHeader className="border-b border-slate-200/60 bg-gradient-to-r from-cyan-50/60 via-white to-white">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-50 border border-cyan-200/60 flex items-center justify-center shadow-sm">
                <Users className="h-4 w-4 text-cyan-700" />
              </div>
              <div>
                <CardTitle className="text-base">Arquetipos de personalidad</CardTitle>
                <CardDescription>Distribución de candidatos agrupados por su perfil derivado del assessment.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-2">
            {/* Summary pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {archetypeEntries.map(([archetype, members]) => (
                <span key={archetype} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50/80 border border-slate-200/50 px-3 py-1 text-[10px] font-semibold text-slate-600 backdrop-blur-sm">
                  {archetype}
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-cyan-100/80 text-[9px] font-bold text-cyan-700">{members.length}</span>
                </span>
              ))}
            </div>
            {/* Collapsible groups */}
            {archetypeEntries.map(([archetype, members], idx) => (
              <ArchetypeGroup key={archetype} archetype={archetype} members={members} index={idx} onViewCandidate={setSelectedCandidate} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
    );
  };



  const renderInvitesView = () => (
    <div className="space-y-6">
      <ViewIntro view="invites" />
      <div className="grid gap-4 md:grid-cols-3">
        <SmallStatCard title="Enviadas" value={String(filteredInvites.filter((item) => item.status === 'sent').length)} hint="pendientes de respuesta" icon={Send} />
        <SmallStatCard title="Completadas" value={String(filteredInvites.filter((item) => item.status === 'completed').length)} hint="assessment finalizado" icon={ClipboardCheck} />
        <SmallStatCard title="Vencidas" value={String(filteredInvites.filter((item) => item.status === 'expired').length)} hint="enlaces fuera de vigencia" icon={Clock3} />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setIsInviteCandidateOpen(true)}>
          <Send className="h-4 w-4" />
          Invitar candidato
        </Button>
      </div>
      <CandidateInvitesPanel invites={filteredInvites} />
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
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

  const renderAuditView = () => {
    const actionCounts = filteredAuditEvents.reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event.action] = (accumulator[event.action] || 0) + 1;
      return accumulator;
    }, {});
    const leadingActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return (
      <div className="space-y-6">
        <ViewIntro view="audit" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SmallStatCard title="Sesiones activas" value={String(filteredActiveAuditSessions.length)} hint="recruiters conectados" icon={ShieldCheck} />
          <SmallStatCard title="Accesos recientes" value={String(filteredRecentAccesses.length)} hint="últimos ingresos" icon={LogIn} />
          <SmallStatCard title="Cierres registrados" value={String(filteredRecentClosures.length)} hint="logout persistido" icon={LogOut} />
          <SmallStatCard title="Eventos operativos" value={String(filteredAuditEvents.length)} hint="acciones auditadas" icon={Activity} />
        </div>

        <Card className="overflow-hidden border-slate-200/90 bg-white shadow-[0_18px_45px_-30px_rgba(14,165,233,0.22)]">
          <CardHeader className="space-y-5 border-b border-slate-200/80 bg-gradient-to-r from-cyan-50/90 via-white to-white pb-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Audit center recruiter
                </div>
                <div>
                  <CardTitle className="text-slate-950">Control operativo y trazabilidad</CardTitle>
                  <CardDescription className="max-w-3xl text-slate-600">
                    Supervisa accesos, cierres y acciones manuales del equipo recruiter en un mismo centro de lectura.
                  </CardDescription>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-cyan-100 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Lectura de riesgo</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {filteredActiveAuditSessions.length
                      ? 'Hay recruiters activos; conviene revisar si la actividad operativa coincide con el volumen esperado.'
                      : 'No hay sesiones abiertas ahora. La trazabilidad reciente queda consolidada en la línea de tiempo.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Foco actual</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {leadingActions.length
                      ? `${formatAuditActionLabel(leadingActions[0][0])} concentra ${leadingActions[0][1]} eventos visibles.`
                      : 'Todavía no hay actividad operativa suficiente para marcar un foco dominante.'}
                  </p>
                </div>
                <div className="flex items-stretch">
                  <Button variant="outline" className="h-full w-full border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50" onClick={exportAuditCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_220px_220px]">
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
            </div>

            <div className="flex flex-wrap gap-2">
              {leadingActions.length ? (
                leadingActions.map(([action, count]) => (
                  <span key={action} className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${getActivityTone(action)}`}>
                    {formatAuditActionLabel(action)} · {count}
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                  Sin acciones dominantes por ahora
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
              <Card className="border-slate-200 bg-slate-50/60 shadow-none">
                <CardHeader className="pb-3">
                  <div>
                    <CardTitle className="text-slate-950">Radar de sesiones</CardTitle>
                    <CardDescription>Quién está dentro ahora, quién entró hace poco y quién ya cerró correctamente.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sesiones activas</p>
                    {filteredActiveAuditSessions.length ? (
                      filteredActiveAuditSessions.map((session) => (
                        <div key={session.sessionId} className="rounded-[24px] border border-cyan-100 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-950">{session.recruiterName}</p>
                              <p className="text-sm text-slate-500">{session.recruiterEmail}</p>
                            </div>
                            <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700">Activa</Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                              <p className="uppercase tracking-[0.18em] text-slate-400">Inicio</p>
                              <p className="mt-1 text-slate-700">{formatDateTime(session.startedAt)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                              <p className="uppercase tracking-[0.18em] text-slate-400">Última actividad</p>
                              <p className="mt-1 text-slate-700">{formatDateTime(session.lastSeenAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                        No hay sesiones activas en este momento.
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Últimos accesos</p>
                      {filteredRecentAccesses.length ? (
                        filteredRecentAccesses.slice(0, 4).map((session) => (
                          <div key={`${session.sessionId}-access`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                            <div className="rounded-2xl bg-white p-2 text-cyan-700 shadow-sm">
                              <LogIn className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900">{session.recruiterName}</p>
                              <p className="text-sm text-slate-500">{formatDateTime(session.startedAt)}</p>
                            </div>
                            <Badge variant="outline">{session.status === 'active' ? 'Activa' : 'Cerrada'}</Badge>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                          Todavía no hay accesos registrados.
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Cierres recientes</p>
                      {filteredRecentClosures.length ? (
                        filteredRecentClosures.slice(0, 4).map((session) => (
                          <div key={`${session.sessionId}-closure`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                            <div className="rounded-2xl bg-white p-2 text-slate-600 shadow-sm">
                              <Clock3 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900">{session.recruiterName}</p>
                              <p className="text-sm text-slate-500">{session.recruiterEmail}</p>
                            </div>
                            <span className="text-xs text-slate-500">{formatDateTime(session.endedAt)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                          Todavia no hay cierres registrados.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-white shadow-none">
                <CardHeader className="pb-3">
                  <div>
                    <CardTitle className="text-slate-950">Lectura de control</CardTitle>
                    <CardDescription>Resumen corto para detectar rápido qué mirar dentro de la actividad recruiter.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Lectura ejecutiva</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {filteredAuditEvents.length
                        ? `Se registran ${filteredAuditEvents.length} acciones visibles en el filtro actual. ${filteredActiveAuditSessions.length ? 'Hay actividad abierta en tiempo real.' : 'No hay sesiones activas ahora mismo.'}`
                        : 'No hay actividad bajo los filtros actuales. Ajusta la búsqueda o exporta el histórico completo si necesitas revisar otro tramo.'}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Cobertura</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        La vista ya mezcla sesiones, accesos, cierres y operaciones manuales. Sirve como registro real de trabajo recruiter.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Atención</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        Si ves muchos eventos de cambio de estado o shortlist en poco tiempo, conviene contrastar si hay una vacante concentrando la mayor parte del movimiento.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Uso sugerido</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        Usa esta vista para auditoría operacional, exporta CSV para respaldo y cruza con la Mesa de decisión cuando quieras entender el contexto del movimiento recruiter.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 bg-white shadow-none">
              <CardHeader className="pb-3">
                <div>
                  <CardTitle className="text-slate-950">Actividad operativa</CardTitle>
                  <CardDescription>Vacantes, candidatos, cambios de estado, entrevistas y configuración del workspace con trazabilidad recruiter.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredAuditEvents.length ? (
                  filteredAuditEvents.map((event) => {
                    const EventIcon = getActivityIcon(event.action);
                    return (
                      <div
                        key={event.id}
                        className="grid gap-4 rounded-[26px] border border-slate-200 bg-slate-50/50 p-4 shadow-sm lg:grid-cols-[auto_minmax(0,1fr)_220px]"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white bg-white text-cyan-700 shadow-sm">
                          <EventIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950">{event.summary}</p>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getActivityTone(event.action)}`}>
                              {formatAuditActionLabel(event.action)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500">
                            {event.recruiterName} · {event.recruiterEmail} · {formatDateTime(event.occurredAt)}
                          </p>
                          {event.details ? <p className="text-sm leading-relaxed text-slate-700">{event.details}</p> : null}
                        </div>
                        <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Lectura rápida</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {event.entityType
                              ? `Afecta ${event.entityType}. ${event.entityId ? `Referencia ${event.entityId}.` : ''}`
                              : 'Evento de sesión o configuración sin entidad operativa asociada.'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
                    Todavía no hay acciones operativas registradas.
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    );
  };

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
            <CardDescription>Vacantes, candidatos, invitaciones y resultados del assessment viven en SQLite a través de la API interna.</CardDescription>
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
    if (activeView === 'invites') return renderInvitesView();
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
          workspaceName={workspace.organizationName}
          ownerName={effectiveOwnerName}
          ownerRole={effectiveOwnerRole}
          availableImports={unimportedAssessments.length}
          searchSummary={searchSummary}
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
            {searchValue.trim() ? (
              <SearchResultsPanel
                query={searchValue.trim()}
                candidates={filteredCandidates}
                jobs={filteredJobs}
                invites={filteredInvites}
                recruiters={filteredRecruiters}
                onClear={() => setSearchValue('')}
              />
            ) : null}
            <div>{renderContent()}</div>
          </main>
        </div>
      </div>

      <CreateVacancyModal open={isCreateVacancyOpen} onOpenChange={setIsCreateVacancyOpen} onCreate={(payload) => void handleCreateVacancy(payload)} />
      <EditVacancyModal
        job={jobToEdit}
        open={!!jobToEdit}
        onOpenChange={(open) => !open && setJobToEdit(null)}
        onUpdate={(payload) => void handleUpdateVacancyModal(payload)}
      />
      <AddCandidateModal open={isAddCandidateOpen} onOpenChange={setIsAddCandidateOpen} onCreate={(payload) => void handleCreateCandidate(payload)} jobs={jobs} />
      <InviteCandidateModal open={isInviteCandidateOpen} onOpenChange={setIsInviteCandidateOpen} onCreate={(payload) => void handleCreateInvite(payload)} jobs={jobs} />
      <ImportAssessmentsModal open={isImportAssessmentsOpen} onOpenChange={setIsImportAssessmentsOpen} assessments={unimportedAssessments} jobs={jobs} onImport={(assessmentId, vacancyId) => void handleImportAssessment(assessmentId, vacancyId)} />
      <CandidateDetailModal
        candidate={selectedCandidate}
        onOpenChange={(next) => !next && setSelectedCandidate(null)}
        jobs={jobs}
        assessmentRecords={assessmentRecords}
        onUpdateCandidate={(payload) => void handleUpdateCandidateProgress(payload)}
        isUpdatingCandidate={isUpdatingCandidate}
      />
      <TeamChemistryModal
        open={isTeamChemistryOpen}
        onOpenChange={setIsTeamChemistryOpen}
        candidates={workspace.candidates}
      />
    </div>
  );
}
