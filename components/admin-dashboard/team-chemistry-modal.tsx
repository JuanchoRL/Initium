'use client';

import { useState, useMemo } from 'react';
import {
  ChevronDown,
  FlaskConical,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  calculateTeamComposition,
  simulateAddCandidate,
  extractDominantTrait,
  type TeamCompositionResult,
  type CandidateFitResult,
} from '@/lib/assessment/team-chemistry';
import { personalityTraitMeta, personalityBlendLabels, type PersonalityTraitId } from '@/lib/assessment/personality';
import type { CandidateResult } from '@/types/admin-dashboard';

const TRAIT_OPTIONS: Array<{ value: PersonalityTraitId; label: string; name: string }> = [
  { value: 'D', label: personalityTraitMeta.D.label, name: personalityTraitMeta.D.name },
  { value: 'I', label: personalityTraitMeta.I.label, name: personalityTraitMeta.I.name },
  { value: 'S', label: personalityTraitMeta.S.label, name: personalityTraitMeta.S.name },
  { value: 'C', label: personalityTraitMeta.C.label, name: personalityTraitMeta.C.name },
];

const TRAIT_COLORS: Record<PersonalityTraitId, string> = {
  D: 'bg-red-500',
  I: 'bg-amber-500',
  S: 'bg-emerald-500',
  C: 'bg-sky-500',
};

const TRAIT_LIGHT: Record<PersonalityTraitId, string> = {
  D: 'bg-red-50 text-red-700 border-red-200',
  I: 'bg-amber-50 text-amber-700 border-amber-200',
  S: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  C: 'bg-sky-50 text-sky-700 border-sky-200',
};

export function TeamChemistryModal({
  open,
  onOpenChange,
  candidates,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  candidates: CandidateResult[];
}) {
  const [teamMembers, setTeamMembers] = useState<PersonalityTraitId[]>([]);
  const [selectedTrait, setSelectedTrait] = useState<PersonalityTraitId>('D');
  const [customLabel, setCustomLabel] = useState('');

  const memberLabels = useMemo(() => {
    const labels: string[] = [];
    for (const trait of teamMembers) {
      labels.push(personalityTraitMeta[trait].label);
    }
    return labels;
  }, [teamMembers]);

  const composition = useMemo(() => calculateTeamComposition(teamMembers), [teamMembers]);

  // Candidates that have personality profiles
  const candidatesWithProfiles = useMemo(
    () =>
      candidates
        .filter((c) => c.personalityProfile && extractDominantTrait(c.personalityProfile))
        .map((c) => ({
          ...c,
          dominantTrait: extractDominantTrait(c.personalityProfile!) as PersonalityTraitId,
        })),
    [candidates]
  );

  // Simulated fit for each candidate
  const candidateFits = useMemo(() => {
    if (teamMembers.length === 0) return [];
    return candidatesWithProfiles
      .map((c) => ({
        candidate: c,
        fit: simulateAddCandidate(teamMembers, c.dominantTrait),
      }))
      .sort((a, b) => b.fit.fitScore - a.fit.fitScore);
  }, [teamMembers, candidatesWithProfiles]);

  const addMember = () => {
    setTeamMembers((prev) => [...prev, selectedTrait]);
  };

  const removeMember = (index: number) => {
    setTeamMembers((prev) => prev.filter((_, i) => i !== index));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button className="absolute inset-0" aria-label="Cerrar modal" onClick={() => onOpenChange(false)} />
      <Card className="relative z-10 my-4 w-full max-w-5xl bg-white shadow-2xl" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-slate-200/80 bg-gradient-to-r from-cyan-50/60 via-white to-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-50 border border-cyan-200/60 flex items-center justify-center shadow-sm">
              <FlaskConical className="h-5 w-5 text-cyan-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950">Simulador de Química de Equipo</h2>
              <p className="text-sm text-slate-500">Modela tu equipo actual y evalúa cómo encajaría cada candidato.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          {/* LEFT: Team Builder */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Add member */}
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-900">Composición del equipo actual</h3>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Agregar perfil DISC</label>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    value={selectedTrait}
                    onChange={(e) => setSelectedTrait(e.target.value as PersonalityTraitId)}
                  >
                    {TRAIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} — {opt.label} ({opt.name})
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={addMember} className="h-10 gap-1.5 px-4">
                  <Plus className="h-4 w-4" /> Agregar
                </Button>
              </div>
            </div>

            {/* Current team members */}
            {teamMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((trait, i) => (
                  <div key={i} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${TRAIT_LIGHT[trait]}`}>
                    <span className={`h-2 w-2 rounded-full ${TRAIT_COLORS[trait]}`} />
                    {personalityTraitMeta[trait].label}
                    <button
                      onClick={() => removeMember(i)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
                      title="Quitar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Team composition metrics */}
            {teamMembers.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Análisis de composición</h3>
                {/* DISC distribution bars */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['D', 'I', 'S', 'C'] as PersonalityTraitId[]).map((trait) => {
                    const count = composition.distribution[trait];
                    const pct = teamMembers.length > 0 ? Math.round((count / teamMembers.length) * 100) : 0;
                    return (
                      <div key={trait} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${TRAIT_COLORS[trait]}`} />
                            <span className="text-xs font-semibold text-slate-700">{personalityTraitMeta[trait].label}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-500">{count} · {pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>

                {/* Summary indicators */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Diversidad</p>
                    <p className={`mt-1 text-2xl font-bold ${composition.diversityScore >= 70 ? 'text-emerald-600' : composition.diversityScore >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      {composition.diversityScore}
                    </p>
                    <p className="text-[10px] text-slate-400">/ 100</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pares de fricción</p>
                    <p className={`mt-1 text-2xl font-bold ${composition.frictionPairs === 0 ? 'text-emerald-600' : composition.frictionPairs <= 2 ? 'text-amber-600' : 'text-red-500'}`}>
                      {composition.frictionPairs}
                    </p>
                    <p className="text-[10px] text-slate-400">conflictos potenciales</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gaps</p>
                    <p className="mt-1 text-2xl font-bold text-slate-800">{composition.gaps.length}</p>
                    <p className="text-[10px] text-slate-400">
                      {composition.gaps.length > 0
                        ? `Falta: ${composition.gaps.map((g) => personalityTraitMeta[g].name).join(', ')}`
                        : 'Todos cubiertos'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {teamMembers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-600">Comenzá armando tu equipo</p>
                <p className="text-xs text-slate-400 mt-1">Agregá los perfiles DISC de los miembros actuales de tu equipo para simular cómo encajarían los candidatos.</p>
              </div>
            )}
          </div>

          {/* RIGHT: Candidate fit rankings */}
          <div className="w-full lg:w-[380px] shrink-0 border-l border-slate-200 bg-slate-50/50 overflow-y-auto p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Compatibilidad de candidatos</h3>

            {teamMembers.length === 0 ? (
              <p className="text-xs text-slate-400">Agregá al menos un miembro al equipo.</p>
            ) : candidateFits.length === 0 ? (
              <p className="text-xs text-slate-400">No hay candidatos con perfil DISC evaluado.</p>
            ) : (
              <div className="space-y-2">
                {candidateFits.map(({ candidate: c, fit }, idx) => {
                  const fitColor =
                    fit.fitScore >= 70 ? 'text-emerald-600' : fit.fitScore >= 45 ? 'text-amber-600' : 'text-red-500';
                  const fitBg =
                    fit.fitScore >= 70 ? 'bg-emerald-50 border-emerald-200' : fit.fitScore >= 45 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                  const complementBadge: Record<string, string> = {
                    alta: 'bg-emerald-100 text-emerald-700',
                    media: 'bg-amber-100 text-amber-700',
                    baja: 'bg-red-100 text-red-700',
                  };
                  const conflictBadge: Record<string, string> = {
                    bajo: 'bg-emerald-100 text-emerald-700',
                    moderado: 'bg-amber-100 text-amber-700',
                    alto: 'bg-red-100 text-red-700',
                  };

                  return (
                    <div key={c.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                            <p className="truncate text-[10px] text-slate-400">{c.personalityProfile}</p>
                          </div>
                        </div>
                        <div className={`rounded-lg border px-2.5 py-1 ${fitBg}`}>
                          <span className={`text-sm font-bold ${fitColor}`}>{fit.fitScore}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${complementBadge[fit.complementarity]}`}>
                          Complementariedad: {fit.complementarity}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${conflictBadge[fit.conflictRisk]}`}>
                          Conflicto: {fit.conflictRisk}
                        </span>
                        {fit.diversityDelta > 0 && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                            Diversidad +{fit.diversityDelta}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{fit.summary}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
