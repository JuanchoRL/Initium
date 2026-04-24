import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, Zap, AlertTriangle, Award } from 'lucide-react';
import { Card, Button } from '@/components/ui/core';
import { clamp, avg, stdDev } from '@/lib/math';
import type { GameResult } from '@/lib/types';

type GameProps = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
};

type LeadershipTaskType = 'Coordinación' | 'Análisis' | 'Ejecución';
type LeadershipRoundId = 'round1' | 'round2';

type LeadershipTask = {
  id: string;
  name: string;
  type: LeadershipTaskType;
  cost: number;
  criticality: 1 | 2 | 3;
  narrative: string;
};

type LeadershipRoundEval = {
  roundScore: number;
  roleMatches: number;
  mismatchCount: number;
  technicalMismatchCount: number;
  criticalMismatchCount: number;
  overloadCount: number;
  unresolvedCritical: number;
  avgLoad: number;
  loadStd: number;
};

type LeadershipActionTone = 'success' | 'warning' | 'danger' | 'neutral';

export const GameLeadership = ({ onComplete, track }: GameProps) => {
  const members = useMemo(
    () => [
      {
        id: 1,
        name: 'Mara',
        strength: 'Da claridad cuando hay señales confusas.',
        role: 'Análisis' as LeadershipTaskType,
        baseLoad: 18,
      },
      {
        id: 2,
        name: 'Bruno',
        strength: 'Excelente resolviendo bloqueos en momentos de urgencia.',
        role: 'Ejecución' as LeadershipTaskType,
        baseLoad: 28,
      },
      {
        id: 3,
        name: 'Inés',
        strength: 'Sostiene acuerdos y comunicación clara bajo presión.',
        role: 'Coordinación' as LeadershipTaskType,
        baseLoad: 16,
      },
    ],
    []
  );

  const memberById = useMemo(() => {
    const map: Record<number, (typeof members)[number]> = {};
    for (const member of members) map[member.id] = member;
    return map;
  }, [members]);

  const round1Tasks = useMemo<LeadershipTask[]>(
    () => [
      {
        id: 'r1_t1',
        name: 'Alinear mensaje con las personas involucradas',
        type: 'Coordinación',
        cost: 24,
        criticality: 2,
        narrative: 'Mantener calma, expectativas claras y prioridades comunes.',
      },
      {
        id: 'r1_t2',
        name: 'Revisar datos del problema',
        type: 'Análisis',
        cost: 20,
        criticality: 2,
        narrative: 'Detectar causa probable y alcance real del impacto.',
      },
      {
        id: 'r1_t3',
        name: 'Resolver bloqueo principal',
        type: 'Ejecución',
        cost: 26,
        criticality: 3,
        narrative: 'Aplicar acción directa para restablecer continuidad.',
      },
      {
        id: 'r1_t4',
        name: 'Actualizar estado al equipo',
        type: 'Coordinación',
        cost: 16,
        criticality: 1,
        narrative: 'Evitar desalineación y reducir ruido operativo.',
      },
      {
        id: 'r1_t5',
        name: 'Priorizar casos urgentes',
        type: 'Análisis',
        cost: 17,
        criticality: 2,
        narrative: 'Ordenar tareas por impacto y tiempo de respuesta.',
      },
    ],
    []
  );

  const [phase, setPhase] = useState<'story' | 'round1' | 'round2'>('story');
  const [storyStep, setStoryStep] = useState(0);
  const [round2Tasks, setRound2Tasks] = useState<LeadershipTask[]>([]);
  const [assignments, setAssignments] = useState<Record<LeadershipRoundId, Record<string, number>>>({
    round1: {},
    round2: {},
  });
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [carryBaseLoad, setCarryBaseLoad] = useState<Record<number, number>>({});
  const [incidentPressure, setIncidentPressure] = useState(0);
  const [reassignments, setReassignments] = useState(0);
  const [overloadWarnings, setOverloadWarnings] = useState(0);
  const [actionFeedback, setActionFeedback] = useState<{ tone: LeadershipActionTone; message: string } | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [showAssignedTasks, setShowAssignedTasks] = useState(false);

  const activeRoundId: LeadershipRoundId = phase === 'round2' ? 'round2' : 'round1';
  const activeTasks = phase === 'round2' ? round2Tasks : round1Tasks;
  const activeAssignments = assignments[activeRoundId];
  const selectedTaskDef = selectedTask ? activeTasks.find((task) => task.id === selectedTask) ?? null : null;
  const pendingTasksCount = activeTasks.filter((task) => !activeAssignments[task.id]).length;
  const visibleTasks = useMemo(
    () =>
      showAssignedTasks
        ? activeTasks
        : activeTasks.filter((task) => !activeAssignments[task.id] || task.id === selectedTask),
    [activeAssignments, activeTasks, selectedTask, showAssignedTasks]
  );

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 1700);
    return () => clearTimeout(timer);
  }, [actionFeedback]);

  const advanceStory = useCallback(() => {
    if (phase !== 'story') return;
    if (storyStep < 2) {
      setStoryStep((step) => step + 1);
      track('decision_made', { type: 'leadership_story_step', step: storyStep + 1 });
      return;
    }
    setPhase('round1');
    track('decision_made', { type: 'leadership_story_completed' });
  }, [phase, storyStep, track]);

  useEffect(() => {
    if (phase !== 'story') return;
    const timer = window.setTimeout(() => {
      advanceStory();
    }, 7000);
    return () => clearTimeout(timer);
  }, [advanceStory, phase, storyStep]);

  const getRoundBaseLoad = useCallback(
    (roundId: LeadershipRoundId, memberId: number) => {
      const member = memberById[memberId];
      if (!member) return 0;
      if (roundId === 'round2') {
        return carryBaseLoad[memberId] ?? member.baseLoad;
      }
      return member.baseLoad;
    },
    [memberById, carryBaseLoad]
  );

  const getLoad = useCallback(
    (roundId: LeadershipRoundId, memberId: number, map: Record<string, number>, tasks: LeadershipTask[]) => {
      let load = getRoundBaseLoad(roundId, memberId);
      for (const task of tasks) {
        if (map[task.id] === memberId) {
          load += task.cost;
        }
      }
      return load;
    },
    [getRoundBaseLoad]
  );

  const evaluateRound = useCallback(
    (roundId: LeadershipRoundId, tasks: LeadershipTask[], map: Record<string, number>): LeadershipRoundEval => {
      let points = 0;
      let roleMatches = 0;
      let mismatchCount = 0;
      let technicalMismatchCount = 0;
      let criticalMismatchCount = 0;
      let overloadCount = 0;
      let unresolvedCritical = 0;

      for (const task of tasks) {
        const memberId = map[task.id];
        if (!memberId) continue;
        const member = memberById[memberId];
        if (!member) continue;

        const roleMatch = member.role === task.type;
        const load = getLoad(roundId, memberId, map, tasks);

        points += roleMatch ? 20 : 6;
        if (task.criticality === 3) points += roleMatch ? 10 : -14;
        if (task.criticality === 2) points += roleMatch ? 5 : -6;

        if (load <= 90) points += 8;
        else if (load <= 102) points += 5;
        else if (load <= 110) points += 2;
        else {
          points -= 10;
          overloadCount += 1;
        }

        if (roleMatch) roleMatches += 1;
        else mismatchCount += 1;

        if (task.type === 'Ejecución' && !roleMatch) technicalMismatchCount += 1;
        if (task.criticality >= 2 && !roleMatch) criticalMismatchCount += 1;
        if (task.criticality === 3 && !roleMatch) unresolvedCritical += 1;
      }

      const loads = members.map((member) => getLoad(roundId, member.id, map, tasks));
      const maxPoints = Math.max(1, tasks.length * 38);

      return {
        roundScore: clamp(Math.round((points / maxPoints) * 100), 0, 100),
        roleMatches,
        mismatchCount,
        technicalMismatchCount,
        criticalMismatchCount,
        overloadCount,
        unresolvedCritical,
        avgLoad: Math.round(avg(loads)),
        loadStd: Number(stdDev(loads).toFixed(2)),
      };
    },
    [getLoad, memberById, members]
  );

  const buildRound2Tasks = useCallback((pressure: number): LeadershipTask[] => {
    const tasks: LeadershipTask[] = [
      {
        id: 'r2_t1',
        name: 'Seguimiento de acuerdos clave',
        type: 'Coordinación',
        cost: 18,
        criticality: 2,
        narrative: 'Confirmar avances y sostener confianza de las partes.',
      },
      {
        id: 'r2_t2',
        name: 'Análisis de causa y prevención',
        type: 'Análisis',
        cost: 18,
        criticality: 2,
        narrative: 'Extraer aprendizajes para evitar repetición.',
      },
    ];

    if (pressure >= 18) {
      tasks.push({
        id: 'r2_t3',
        name: 'Cerrar bloqueo de continuidad',
        type: 'Ejecución',
        cost: 22,
        criticality: 3,
        narrative: 'Cerrar el punto crítico antes del siguiente pico de demanda.',
      });
    }

    if (pressure >= 34) {
      tasks.push({
        id: 'r2_t4',
        name: 'Plan de respaldo y turnos',
        type: 'Coordinación',
        cost: 16,
        criticality: 2,
        narrative: 'Prevenir cuellos de botella en la etapa de estabilización.',
      });
    }

    return tasks;
  }, []);

  const handleAssign = (memberId: number) => {
    if (!selectedTask) return;

    const currentAssignments = assignments[activeRoundId];
    const previousMemberId = currentAssignments[selectedTask];
    const nextAssignments = { ...currentAssignments, [selectedTask]: memberId };
    const selectedTaskDefLocal = activeTasks.find((task) => task.id === selectedTask);
    const projectedLoad = getLoad(activeRoundId, memberId, nextAssignments, activeTasks);

    if (previousMemberId && previousMemberId !== memberId) {
      setReassignments((value) => value + 1);
      track('decision_changed', { round: activeRoundId, taskId: selectedTask, from: previousMemberId, to: memberId });
    } else {
      track('decision_made', { round: activeRoundId, taskId: selectedTask, memberId });
    }

    if (selectedTaskDefLocal && selectedTaskDefLocal.type === 'Ejecución' && memberById[memberId]?.role !== 'Ejecución') {
      track('error_committed', {
        type: 'leadership_technical_mismatch',
        round: activeRoundId,
        taskId: selectedTaskDefLocal.id,
        memberId,
      });
    }

    if (projectedLoad > 110) {
      setOverloadWarnings((value) => value + 1);
      track('error_committed', {
        type: 'leadership_overload',
        round: activeRoundId,
        taskId: selectedTask,
        memberId,
        projectedLoad,
      });
    }

    const taskMismatch = Boolean(selectedTaskDefLocal && memberById[memberId] && selectedTaskDefLocal.type !== memberById[memberId].role);
    if (projectedLoad > 110) {
      setActionFeedback({ tone: 'danger', message: 'Asignación registrada con sobrecarga inmediata.' });
    } else if (selectedTaskDefLocal?.criticality === 3 && taskMismatch) {
      setActionFeedback({ tone: 'danger', message: 'Asignación crítica con riesgo operativo alto.' });
    } else if (projectedLoad > 102) {
      setActionFeedback({ tone: 'warning', message: 'Asignación guardada al límite de carga.' });
    } else {
      setActionFeedback({ tone: 'success', message: 'Asignación registrada correctamente.' });
    }

    setAssignments((prev) => ({
      ...prev,
      [activeRoundId]: nextAssignments,
    }));
    setSelectedTask(null);
  };

  const handleUnassign = (taskId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const nextAssignments = { ...assignments[activeRoundId] };
    delete nextAssignments[taskId];
    setAssignments((prev) => ({
      ...prev,
      [activeRoundId]: nextAssignments,
    }));
    setActionFeedback({ tone: 'neutral', message: 'Asignación removida. Puedes reasignar.' });
    track('decision_changed', { round: activeRoundId, taskId, action: 'unassign' });
  };

  const allAssignedCurrentRound = activeTasks.length > 0 && Object.keys(activeAssignments).length === activeTasks.length;

  const proceedToRound2 = () => {
    const round1Eval = evaluateRound('round1', round1Tasks, assignments.round1);
    const pressure = round1Eval.technicalMismatchCount * 14 + round1Eval.criticalMismatchCount * 8 + round1Eval.overloadCount * 6;

    const carryLoads: Record<number, number> = {};
    for (const member of members) {
      const round1Load = getLoad('round1', member.id, assignments.round1, round1Tasks);
      const overflow = Math.max(0, round1Load - member.baseLoad);
      carryLoads[member.id] = clamp(Math.round(member.baseLoad + overflow * 0.35), member.baseLoad, 95);
    }

    const nextRound2Tasks = buildRound2Tasks(pressure);

    setCarryBaseLoad(carryLoads);
    setRound2Tasks(nextRound2Tasks);
    setIncidentPressure(pressure);
    setSelectedTask(null);
    setPhase('round2');

    track('round_completed', {
      round: 'round1',
      roundScore: round1Eval.roundScore,
      incidentPressure: pressure,
      round2TaskCount: nextRound2Tasks.length,
    });
  };

  const finalize = () => {
    const round1Eval = evaluateRound('round1', round1Tasks, assignments.round1);
    const round2Eval = evaluateRound('round2', round2Tasks, assignments.round2);

    const recoveryIndex = clamp(
      Math.round(
        100 -
          incidentPressure +
          round2Eval.roleMatches * 8 -
          round2Eval.technicalMismatchCount * 12 -
          round2Eval.unresolvedCritical * 10 -
          round2Eval.overloadCount * 8
      ),
      0,
      100
    );

    const disciplineIndex = clamp(100 - reassignments * 3 - overloadWarnings * 2, 0, 100);
    const finalScore = clamp(
      Math.round(round1Eval.roundScore * 0.45 + round2Eval.roundScore * 0.4 + ((recoveryIndex + disciplineIndex) / 2) * 0.15),
      0,
      100
    );

    const totalTasks = round1Tasks.length + round2Tasks.length;
    const totalRoleMatches = round1Eval.roleMatches + round2Eval.roleMatches;
    const totalMismatches = round1Eval.mismatchCount + round2Eval.mismatchCount;
    const totalTechnicalMismatch = round1Eval.technicalMismatchCount + round2Eval.technicalMismatchCount;
    const totalCriticalMismatch = round1Eval.criticalMismatchCount + round2Eval.criticalMismatchCount;

    track('game_submitted', {
      score: finalScore,
      round1Score: round1Eval.roundScore,
      round2Score: round2Eval.roundScore,
      recoveryIndex,
      disciplineIndex,
      totalMismatches,
      technicalMismatch: totalTechnicalMismatch,
      criticalMismatch: totalCriticalMismatch,
    });

    onComplete({
      score: finalScore,
      metrics: {
        role_match_count: totalRoleMatches,
        role_match_rate: Number((totalRoleMatches / totalTasks).toFixed(2)),
        mismatch_count: totalMismatches,
        technical_mismatch_count: totalTechnicalMismatch,
        critical_mismatch_count: totalCriticalMismatch,
        reassignments,
        overload_warnings: overloadWarnings,
        round1_score: round1Eval.roundScore,
        round2_score: round2Eval.roundScore,
        recovery_index: recoveryIndex,
        incident_pressure: incidentPressure,
        avg_team_load: Math.round((round1Eval.avgLoad + round2Eval.avgLoad) / 2),
        load_std_dev: Number(((round1Eval.loadStd + round2Eval.loadStd) / 2).toFixed(2)),
      },
    });
  };

  if (phase === 'story') {
    const storyScreens = [
      {
        eyebrow: 'Puesta en situación',
        title: 'Tu equipo entra en una jornada critica',
        lines: [
          'Hay demoras y reclamos. Necesitas organizar al equipo para recuperar estabilidad.',
          'Tus decisiones impactan la calidad final y la carga de cada persona.',
        ],
      },
      {
        eyebrow: 'Qué está en juego',
        title: 'Recursos limitados, prioridades en conflicto',
        lines: [
          'No puedes asignar todo a la misma persona: el agotamiento reduce el rendimiento.',
          'Habrá una segunda etapa con nuevas exigencias según lo que decidas ahora.',
        ],
      },
      {
        eyebrow: 'Como se juega',
        title: 'Objetivo en menos de 10 segundos',
        lines: [
          '1) Selecciona una tarea.',
          '2) Asignala a quien tenga mejor perfil y carga.',
          '3) Completa el plan y ajusta en la segunda etapa.',
        ],
      },
    ];
    const screen = storyScreens[storyStep];

    return (
      <div className="w-full max-w-4xl mx-auto animate-fade-in pt-8 px-4">
        <Card className="border-l-4 border-l-cyan-500 space-y-5">
          <div>
            <div className="text-xs font-bold text-cyan-600 uppercase tracking-wide mb-2">{screen.eyebrow}</div>
            <h3 className="text-2xl font-bold text-stone-800">{screen.title}</h3>
            <div className="space-y-2 mt-3">
              {screen.lines.map((line) => (
                <p key={line} className="text-sm text-stone-600 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${((storyStep + 1) / storyScreens.length) * 100}%` }} />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={advanceStory}
              className="px-8"
            >
              {storyStep < storyScreens.length - 1 ? 'Siguiente' : 'Iniciar nivel 1'} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const feedbackToneClass: Record<LeadershipActionTone, string> = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    danger: 'bg-red-50 border-red-200 text-red-700',
    neutral: 'bg-stone-50 border-stone-200 text-stone-700',
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in pt-8 px-4 space-y-4">
      <Card className="p-4 border-stone-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wide text-cyan-600">
              {phase === 'round1' ? 'Nivel 1 · Contención inicial' : 'Nivel 2 · Recuperación operativa'}
            </div>
            <h3 className="text-lg font-bold text-stone-800">
              {phase === 'round1' ? 'Asigna el primer bloque de respuesta' : 'Gestiona la segunda ola de tareas'}
            </h3>
            <p className="text-sm text-stone-600">
              {phase === 'round1'
                ? 'Selecciona una tarea y asigna la persona más adecuada.'
                : 'Ajusta el plan con fatiga acumulada y nuevas exigencias.'}
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold uppercase tracking-wide">
              <span className={`px-2 py-1 rounded-full border ${selectedTask ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-cyan-600 text-white border-cyan-600'}`}>
                1. Selecciona tarea
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              <span className={`px-2 py-1 rounded-full border ${selectedTask ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>
                2. Asigna persona
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="bg-stone-50 border border-stone-200 rounded-full px-3 py-1 text-xs font-semibold text-stone-700">
              Reasignaciones: {reassignments}
            </div>
            <div className="bg-red-50 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold text-red-600">
              Alertas de carga: {overloadWarnings}
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                incidentPressure >= 30
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : incidentPressure >= 15
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-cyan-50 border-cyan-200 text-cyan-700'
              }`}
            >
              Presion: {incidentPressure}
            </div>
          </div>
        </div>

        {actionFeedback ? (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium animate-fade-in ${feedbackToneClass[actionFeedback.tone]}`}>
            {actionFeedback.message}
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1.04fr_0.96fr] gap-4 items-start">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-2">
            <div>
              <h4 className="font-bold text-stone-700">
                Tareas ({Object.keys(activeAssignments).length}/{activeTasks.length})
              </h4>
              <span className="text-[11px] text-stone-500">{pendingTasksCount} pendientes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-stone-500">{selectedTask ? 'Asignar persona' : 'Selecciona una tarea'}</span>
              <button
                onClick={() => setShowAssignedTasks((value) => !value)}
                className="text-[11px] text-cyan-700 hover:text-cyan-800 font-semibold"
              >
                {showAssignedTasks ? 'Ocultar asignadas' : 'Ver asignadas'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {visibleTasks.map((task) => {
              const assignedId = activeAssignments[task.id];
              const assignedMember = assignedId ? memberById[assignedId] : null;
              const isAssigned = Boolean(assignedId);
              const priorityLabel = task.criticality === 3 ? 'Prioridad alta' : task.criticality === 2 ? 'Prioridad media' : 'Prioridad base';

              return (
                <div key={task.id} className="relative group">
                  <button
                    onClick={() => setSelectedTask(task.id)}
                    className={`w-full p-3 text-left rounded-lg border transition-all ${
                      selectedTask === task.id
                        ? 'bg-cyan-50 border-cyan-500 ring-1 ring-cyan-500 shadow-sm'
                        : isAssigned
                          ? 'bg-stone-50 border-stone-200'
                          : 'bg-white border-stone-200 hover:border-cyan-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-stone-800">{task.name}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded text-[11px] font-bold text-stone-600">
                          <Zap className="w-3 h-3 text-yellow-500" /> +{task.cost}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-semibold">{priorityLabel}</span>
                      {assignedMember ? (
                        <span className="text-[10px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded font-semibold">
                          {assignedMember.name}
                        </span>
                      ) : null}
                    </div>
                  </button>

                  {isAssigned ? (
                    <button
                      onClick={(event) => handleUnassign(task.id, event)}
                      className="absolute -right-2 -top-2 bg-red-100 text-red-500 rounded-full px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-red-200 text-xs"
                      title="Desasignar"
                    >
                      x
                    </button>
                  ) : null}
                </div>
              );
            })}
            {!visibleTasks.length ? (
              <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
                No hay tareas pendientes visibles. Puedes mostrar las asignadas para revisar ajustes.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-4 space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-2">
            <h4 className="font-bold text-stone-700">Equipo</h4>
            {!selectedTask ? (
              <span className="text-[11px] text-stone-500">Paso 1: selecciona tarea</span>
            ) : (
              <button
                onClick={() => setShowTeamDetails((value) => !value)}
                className="text-[11px] text-cyan-700 hover:text-cyan-800 font-semibold"
              >
                {showTeamDetails ? 'Ocultar detalle' : 'Ver detalle'}
              </button>
            )}
          </div>

          {!selectedTaskDef ? (
            <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
              Elige una tarea para comparar capacidad y asignarla al miembro más conveniente.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-700">Tarea activa</div>
                <p className="text-sm font-semibold text-cyan-900">{selectedTaskDef.name}</p>
                <p className="text-xs text-cyan-800 mt-1">{selectedTaskDef.narrative}</p>
              </div>

              <div className="space-y-2">
                {members.map((member) => {
                  const currentLoad = getLoad(activeRoundId, member.id, activeAssignments, activeTasks);
                  const selectedTaskCost = selectedTaskDef.cost;
                  const selectedAlreadyOnMember = activeAssignments[selectedTaskDef.id] === member.id;
                  const previewLoad = currentLoad + (!selectedAlreadyOnMember ? selectedTaskCost : 0);
                  const overload = previewLoad > 110;
                  const warning = previewLoad > 102;
                  return (
                    <button
                      key={member.id}
                      onClick={() => handleAssign(member.id)}
                      className="w-full p-3 bg-white border rounded-lg transition-all shadow-sm text-left hover:border-cyan-300"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-800">{member.name}</div>
                          {showTeamDetails ? (
                            <p className="text-[11px] text-stone-500 leading-snug mt-0.5">{member.strength}</p>
                          ) : null}
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold ${currentLoad > 102 ? 'text-red-500' : 'text-stone-500'}`}>{currentLoad}%</div>
                        </div>
                      </div>

                      <div className="mt-2 w-full h-2.5 bg-stone-100 rounded-full overflow-hidden relative border border-stone-200">
                        <div
                          className={`h-full transition-all duration-300 ${currentLoad > 102 ? 'bg-red-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.min(100, currentLoad)}%` }}
                        />
                        {!selectedAlreadyOnMember ? (
                          <div
                            className={`absolute top-0 h-full opacity-60 ${overload ? 'bg-red-600' : 'bg-yellow-400'}`}
                            style={{
                              left: `${Math.min(100, currentLoad)}%`,
                              width: `${Math.min(Math.max(100 - currentLoad, 0), selectedTaskCost)}%`,
                            }}
                          />
                        ) : null}
                      </div>

                      {showTeamDetails
                        ? overload ? (
                            <div className="mt-1 text-[11px] text-red-500 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Sobrecarga
                            </div>
                          ) : warning ? (
                            <div className="mt-1 text-[11px] text-orange-500 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Al límite
                            </div>
                          ) : null
                        : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {allAssignedCurrentRound ? (
        <div className="flex justify-center pt-1">
          {phase === 'round1' ? (
            <Button onClick={proceedToRound2} className="px-12 py-4 text-lg">
              Simular consecuencias (nivel 2) <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={finalize} className="px-12 py-4 text-lg">
              <Award className="w-5 h-5" /> Confirmar plan final
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
};
