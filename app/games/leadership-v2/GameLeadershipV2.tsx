'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { clsx } from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { persons, round1Tasks, round2Tasks, round3Tasks, events } from './data';
import { applyRecovery, calculateFatigue, evaluateRound, recalculateStateFromTasks } from './scoring';
import { EventToast } from './EventToast';
import { PersonPanel } from './PersonPanel';
import { ResultsModal } from './ResultsModal';
import { TaskCard, TaskCardPreview } from './TaskCard';
import type { GameEvent, PersonState, RoundEvaluationBundle, RoundResult, Task } from './types';
import { useTutorial } from '@/lib/hooks/useTutorial';
import { TutorialOverlay } from '@/components/ui/TutorialOverlay';

type GameResult = { score: number; metrics: Record<string, number | string | boolean> };

type Props = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
};

const initialStates: PersonState[] = persons.map((person) => ({
  id: person.id,
  fatigue_cognitive: 0,
  fatigue_emotional: 0,
  fatigue_time: 0,
  base_fatigue_cognitive: 0,
  base_fatigue_emotional: 0,
  base_fatigue_time: 0,
  assignedTasks: [],
}));

const avg = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

function BacklogDropZone({
  isOver,
  children,
}: {
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: 'backlog' });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'w-80 shrink-0 flex flex-col gap-3 bg-slate-100/60 p-4 rounded-3xl border-2 transition-all',
        isOver ? 'border-cyan-300 ring-2 ring-cyan-200 bg-cyan-50/60' : 'border-slate-200'
      )}
    >
      {children}
    </div>
  );
}

export default function GameLeadershipV2({ onComplete, track }: Props) {
  const [round, setRound] = useState(1);
  const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
  const [personStates, setPersonStates] = useState<PersonState[]>(initialStates);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<GameEvent | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [reassignments, setReassignments] = useState(0);

  const roundBundlesRef = useRef<RoundEvaluationBundle[]>([]);

  const tutorial = useTutorial([
    {
      id: 'step-profiles',
      targetId: 'leadership-profiles-container',
      title: 'Perfiles y Habilidades',
      description: 'Evalúa la energía y habilidades de tu equipo. Asignar mal las tareas puede agotar sus barras rápidamente. Haz clic para continuar.',
      actionRequired: 'custom',
      animationType: 'click',
    },
    {
      id: 'step-drag-task',
      targetId: 'task-t1',
      title: 'Gestión de Recursos',
      description: 'Arrastra esta tarea urgente hacia el perfil más adecuado para completarla.',
      actionRequired: 'drag',
      animationType: 'drag',
    }
  ], true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadRoundTasks = useCallback(
    (nextRound: number) => {
      let tasks: Task[] = [];
      if (nextRound === 1) tasks = [...round1Tasks];
      if (nextRound === 2) tasks = [...round2Tasks];
      if (nextRound === 3) tasks = [...round3Tasks];

      const event = events.find((item) => item.round === nextRound) || null;
      const finalTasks = event ? event.effect(tasks) : tasks;

      setUnassignedTasks(finalTasks.map((task) => ({ ...task })));
      setActiveEvent(event);

      track('decision_made', {
        type: 'leadership_round_loaded',
        round: nextRound,
        taskCount: finalTasks.length,
        hasEvent: Boolean(event),
        eventId: event?.id,
      });
    },
    [track]
  );

  useEffect(() => {
    loadRoundTasks(round);
  }, [loadRoundTasks, round]);

  useEffect(() => {
    if (!activeEvent) return;
    const timer = window.setTimeout(() => setActiveEvent(null), 6500);
    return () => clearTimeout(timer);
  }, [activeEvent]);

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    return [...unassignedTasks, ...personStates.flatMap((state) => state.assignedTasks)].find((task) => task.id === activeId) || null;
  }, [activeId, personStates, unassignedTasks]);

  const completedRounds = roundBundlesRef.current.length;
  const averageScore = completedRounds
    ? Math.round(avg(roundBundlesRef.current.map((bundle) => bundle.result.totalScore)))
    : 0;

  useEffect(() => {
    track('game_started', { type: 'leadership_v2_start' });
  }, [track]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);

    const { active, over } = event;
    if (!over) return;

    if (tutorial.isActive && tutorial.currentStep?.id === 'step-drag-task') {
      tutorial.advanceStep();
    }

    const taskId = String(active.id);
    const destinationId = String(over.id);

    let task = unassignedTasks.find((item) => item.id === taskId);
    let sourcePersonId: string | null = null;
    let sourceFromBacklog = false;

    if (task) {
      sourceFromBacklog = true;
    } else {
      for (const state of personStates) {
        const found = state.assignedTasks.find((item) => item.id === taskId);
        if (found) {
          task = found;
          sourcePersonId = state.id;
          break;
        }
      }
    }

    if (!task) return;

    const droppingOnPerson = persons.some((person) => person.id === destinationId);
    const droppingOnBacklog = destinationId === 'backlog';

    if (!droppingOnPerson && !droppingOnBacklog) return;
    if (sourcePersonId && destinationId === sourcePersonId) return;
    if (sourceFromBacklog && droppingOnBacklog) return;

    let nextUnassigned = [...unassignedTasks];
    let nextStates = personStates.map((state) => ({ ...state, assignedTasks: [...state.assignedTasks] }));

    if (sourceFromBacklog) {
      nextUnassigned = nextUnassigned.filter((item) => item.id !== taskId);
    }

    if (sourcePersonId) {
      nextStates = nextStates.map((state) => {
        if (state.id !== sourcePersonId) return state;
        const person = persons.find((item) => item.id === sourcePersonId);
        if (!person) return state;
        const remaining = state.assignedTasks.filter((item) => item.id !== taskId);
        return recalculateStateFromTasks(person, state, remaining);
      });
    }

    if (droppingOnBacklog) {
      if (!nextUnassigned.some((item) => item.id === task.id)) {
        nextUnassigned = [task, ...nextUnassigned];
      }
      track('decision_changed', {
        type: 'leadership_task_unassigned',
        taskId: task.id,
        from: sourcePersonId,
        round,
      });
    }

    if (droppingOnPerson) {
      const targetPerson = persons.find((item) => item.id === destinationId);
      if (!targetPerson) return;

      nextStates = nextStates.map((state) => {
        if (state.id !== destinationId) return state;
        return calculateFatigue(targetPerson, state, task!);
      });

      if (sourcePersonId && sourcePersonId !== destinationId) {
        setReassignments((value) => value + 1);
        track('decision_changed', {
          type: 'leadership_reassignment',
          taskId: task.id,
          from: sourcePersonId,
          to: destinationId,
          round,
        });
      } else {
        track('decision_made', {
          type: 'leadership_assignment',
          taskId: task.id,
          to: destinationId,
          round,
        });
      }
    }

    setUnassignedTasks(nextUnassigned);
    setPersonStates(nextStates);
  };

  const confirmRound = () => {
    if (roundResult) return;

    const bundle = evaluateRound(persons, personStates, unassignedTasks);
    roundBundlesRef.current = [...roundBundlesRef.current, bundle];
    setRoundResult(bundle.result);

    track('round_completed', {
      round,
      score: bundle.result.totalScore,
      fit: bundle.result.fitScore,
      compliance: bundle.result.complianceScore,
      balance: bundle.result.balanceScore,
      risk: bundle.result.riskScore,
      pending: bundle.counters.pendingCount,
    });
  };

  const completeGame = () => {
    const bundles = roundBundlesRef.current;
    const totalRounds = bundles.length || 1;

    const totalScore = Math.round(avg(bundles.map((bundle) => bundle.result.totalScore)));
    const totalTasks = bundles.reduce((sum, bundle) => sum + bundle.counters.totalTasks, 0);
    const totalRoleMatches = bundles.reduce((sum, bundle) => sum + bundle.counters.roleMatchCount, 0);
    const totalMismatches = bundles.reduce((sum, bundle) => sum + bundle.counters.mismatchCount, 0);
    const totalTechnicalMismatch = bundles.reduce((sum, bundle) => sum + bundle.counters.technicalMismatchCount, 0);
    const totalOverloadWarnings = bundles.reduce((sum, bundle) => sum + bundle.counters.overloadWarnings, 0);
    const totalPending = bundles.reduce((sum, bundle) => sum + bundle.counters.pendingCount, 0);

    const roleMatchRate = totalTasks > 0 ? Number((totalRoleMatches / totalTasks).toFixed(2)) : 0;

    const roundScores = bundles.map((bundle) => bundle.result.totalScore);
    const roundScoreStd =
      roundScores.length < 2
        ? 0
        : Math.sqrt(roundScores.reduce((sum, value) => sum + (value - avg(roundScores)) ** 2, 0) / roundScores.length);

    track('game_submitted', {
      score: totalScore,
      roleMatchRate,
      mismatchCount: totalMismatches,
      technicalMismatchCount: totalTechnicalMismatch,
      overloadWarnings: totalOverloadWarnings,
      rounds: totalRounds,
      pending: totalPending,
      reassignments,
    });

    onComplete({
      score: totalScore,
      metrics: {
        role_match_rate: roleMatchRate,
        mismatch_count: totalMismatches,
        technical_mismatch_count: totalTechnicalMismatch,
        overload_warnings: totalOverloadWarnings,
        reassignments,
        rounds_played: totalRounds,
        pending_tasks_total: totalPending,
        score_round_1: roundScores[0] ?? 0,
        score_round_2: roundScores[1] ?? 0,
        score_round_3: roundScores[2] ?? 0,
        score_stability: Number(roundScoreStd.toFixed(2)),
      },
    });
  };

  const nextRound = () => {
    if (round === 3) {
      completeGame();
      return;
    }

    setRoundResult(null);
    setPersonStates((prev) => applyRecovery(prev));
    setRound((value) => value + 1);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto pt-4 px-4 space-y-4 animate-fade-in pb-8">
      <TutorialOverlay
        isActive={tutorial.isActive}
        targetRect={tutorial.targetRect}
        step={tutorial.currentStep}
      />
      <EventToast event={activeEvent} onClose={() => setActiveEvent(null)} />

      {roundResult && <ResultsModal result={roundResult} round={round} isFinalRound={round === 3} onNextRound={nextRound} />}

      <header className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl px-6 py-4 flex justify-between items-center sticky top-20 z-10">
        <div className="flex items-center gap-4">
          <div className="bg-cyan-100 text-cyan-800 font-black px-3 py-1 rounded-lg text-lg">Ronda {round}/3</div>
          <p className="text-sm font-medium text-slate-500 hidden md:block">Asigna todas las tareas antes de confirmar.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <span>Completadas: {completedRounds}</span>
            <span>•</span>
            <span>Promedio: {averageScore}</span>
            <span>•</span>
            <span>Reasignaciones: {reassignments}</span>
          </div>
          <button
            onClick={confirmRound}
            className={clsx(
              'px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-md',
              roundResult ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700 text-white hover:scale-105'
            )}
            disabled={Boolean(roundResult)}
          >
            Confirmar asignación
          </button>
        </div>
      </header>

      <main className="w-full overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 min-w-max items-start pb-2">
            <BacklogDropZone isOver={overId === 'backlog'}>
              <h2 className="font-bold text-slate-800 flex items-center justify-between px-1">
                Backlog
                <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">{unassignedTasks.length}</span>
              </h2>

              <div className="flex-1 min-h-[500px] flex flex-col gap-3">
                {unassignedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}

                {unassignedTasks.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-cyan-700 text-sm font-semibold border-2 border-dashed border-cyan-300 rounded-2xl bg-cyan-50">
                    <CheckCircle2 className="w-6 h-6 mb-1" />
                    Backlog vacío
                  </div>
                )}
              </div>
            </BacklogDropZone>

            <div
              id="leadership-profiles-container"
              className={`flex gap-6 relative ${tutorial.isActive && tutorial.currentStep?.id === 'step-profiles' ? 'cursor-pointer' : ''}`}
              onClickCapture={() => {
                if (tutorial.isActive && tutorial.currentStep?.id === 'step-profiles') {
                  tutorial.advanceStep();
                }
              }}
            >
              {persons.map((person) => {
                const state = personStates.find((item) => item.id === person.id);
                if (!state) return null;
                return (
                  <div key={person.id} className="w-80 shrink-0">
                    <PersonPanel person={person} state={state} isOver={overId === person.id} />
                  </div>
                );
              })}
            </div>
          </div>

          <DragOverlay>{activeTask ? <TaskCardPreview task={activeTask} /> : null}</DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
