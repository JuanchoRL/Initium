'use client';

import { GitBranch, MessageSquareQuote, ShieldCheck, Target, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { buildCandidateSkillsGraph, type SkillGraphNode, type SkillGraphStatus } from '@/lib/admin-dashboard/skills-graph';
import type { MetricsMap } from '@/lib/types';
import type { CandidateResult, JobOpening } from '@/types/admin-dashboard';
import { cn } from '@/lib/utils';

const statusCopy: Record<SkillGraphStatus, { label: string; badge: string; bar: string; surface: string }> = {
  exceeds: {
    label: 'Fortaleza',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    bar: 'bg-emerald-500',
    surface: 'border-emerald-100 bg-emerald-50/50',
  },
  meets: {
    label: 'Fit',
    badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    bar: 'bg-cyan-500',
    surface: 'border-cyan-100 bg-cyan-50/50',
  },
  watch: {
    label: 'Validar',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    bar: 'bg-amber-500',
    surface: 'border-amber-100 bg-amber-50/50',
  },
  gap: {
    label: 'Brecha',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    bar: 'bg-rose-500',
    surface: 'border-rose-100 bg-rose-50/50',
  },
};

const evidenceToneClass = {
  positive: 'bg-emerald-400',
  neutral: 'bg-slate-400',
  caution: 'bg-amber-400',
};

function SkillNodeCard({ node }: { node: SkillGraphNode }) {
  const status = statusCopy[node.status];
  const observedWidth = Math.min(node.observedLevel, 100);
  const requiredLeft = Math.min(Math.max(node.requiredLevel, 0), 100);

  return (
    <div className={cn('rounded-2xl border p-4 shadow-sm', status.surface)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-950">{node.label}</p>
            <span className="rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {node.category}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{node.description}</p>
        </div>
        <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]', status.badge)}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-slate-600">Observado {node.observedLevel}/100</span>
          <span className="font-medium text-slate-500">Requerido {node.requiredLevel}/100</span>
        </div>
        <div className="relative">
          <Progress value={observedWidth} className="h-2.5 bg-white/80" indicatorClassName={status.bar} />
          <span
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-slate-900/55"
            style={{ left: `${requiredLeft}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>{node.gap >= 0 ? `+${node.gap} sobre requerimiento` : `${node.gap} bajo requerimiento`}</span>
          <span>Confianza {node.confidence}%</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {node.evidence.slice(0, 3).map((item) => (
          <div key={`${node.id}-${item.label}-${item.value}`} className="rounded-xl border border-white/80 bg-white/80 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', evidenceToneClass[item.tone])} />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
              <span className="ml-auto text-[11px] font-semibold text-slate-700">{item.value}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {item.source}: {item.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" />
        <span>{node.interviewPrompt}</span>
      </div>
    </div>
  );
}

export function SkillsGraphPanel({
  candidate,
  job,
  metrics,
}: {
  candidate: CandidateResult;
  job?: Pick<JobOpening, 'title' | 'department' | 'scoreProfileId'> | null;
  metrics?: Partial<MetricsMap> | null;
}) {
  const graph = buildCandidateSkillsGraph({ candidate, job, metrics });
  const readinessTone =
    graph.readiness >= 78 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : graph.readiness >= 62 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-rose-700 bg-rose-50 border-rose-100';

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-cyan-200/70 bg-gradient-to-b from-cyan-50/80 via-white to-white shadow-sm" data-testid="skills-graph-panel">
      <div className="border-b border-cyan-100/80 bg-white/60 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-700">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Skills Graph</h3>
                <Badge variant="outline" className="bg-white">Perfil {graph.profileLabel}</Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{graph.headline}</p>
            </div>
          </div>
          <div className={cn('shrink-0 rounded-2xl border px-4 py-3 text-right shadow-sm', readinessTone)}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">Readiness skills</p>
            <p className="mt-1 text-2xl font-bold">{graph.readiness}/100</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Mayor evidencia</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{graph.strongestSkill?.label ?? 'Sin datos'}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {graph.strongestSkill ? `${graph.strongestSkill.observedLevel}/100 observado frente a ${graph.strongestSkill.requiredLevel}/100 requerido.` : 'Completa una evaluación para ver fortalezas.'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700">
              <Target className="h-4 w-4" />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Brecha principal</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{graph.largestGap?.label ?? 'Sin datos'}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {graph.largestGap ? `${graph.largestGap.gap >= 0 ? '+' : ''}${graph.largestGap.gap} puntos frente al requerimiento de la vacante.` : 'No hay brechas visibles todavía.'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-cyan-700">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Cómo leerlo</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              La barra muestra evidencia observada. La marca negra indica el nivel requerido para esta vacante.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {graph.nodes.map((node) => (
            <SkillNodeCard key={node.id} node={node} />
          ))}
        </div>
      </div>
    </section>
  );
}
