import type { Person, PersonState, RoundCounters, RoundEvaluationBundle, RoundResult, Task } from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const avg = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = avg(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const exposureWeight: Record<Task['stakeholder_exposure'], number> = {
  bajo: 0.7,
  medio: 1,
  alto: 1.35,
};

export const calculateFatigue = (person: Person, state: PersonState, task: Task): PersonState => {
  // Escalado calibrado para evitar burnout prematuro (2 tareas no deberían saturar por defecto).
  const cognitiveLoad =
    task.demand_tech * person.modifiers.tech +
    task.demand_analysis * person.modifiers.analysis +
    task.ambiguity * person.modifiers.ambiguity * 0.75 +
    task.duration_points * 0.75 +
    task.switching_penalty * 0.6;
  const cognitiveDelta = clamp(cognitiveLoad * 1.08, 0, 38);

  const emotionalLoad =
    task.demand_social * person.modifiers.social +
    task.demand_emotional * person.modifiers.emotional +
    task.risk_if_wrong * exposureWeight[task.stakeholder_exposure] * 0.75 +
    task.urgency * 0.5;
  const emotionalDelta = clamp(emotionalLoad * 0.98, 0, 36);

  const timeLoad =
    task.urgency * person.modifiers.urgency +
    task.duration_points * 1 +
    task.switching_penalty * 0.65 +
    exposureWeight[task.stakeholder_exposure] * 0.8;
  const timeDelta = clamp(timeLoad * 1.05, 0, 34);

  return {
    ...state,
    fatigue_cognitive: clamp(Number((state.fatigue_cognitive + cognitiveDelta).toFixed(1)), 0, 100),
    fatigue_emotional: clamp(Number((state.fatigue_emotional + emotionalDelta).toFixed(1)), 0, 100),
    fatigue_time: clamp(Number((state.fatigue_time + timeDelta).toFixed(1)), 0, 100),
    assignedTasks: [...state.assignedTasks, task],
  };
};

export const recalculateStateFromTasks = (person: Person, baseState: PersonState, tasks: Task[]) => {
  let next: PersonState = {
    ...baseState,
    fatigue_cognitive: baseState.base_fatigue_cognitive,
    fatigue_emotional: baseState.base_fatigue_emotional,
    fatigue_time: baseState.base_fatigue_time,
    assignedTasks: [],
  };

  for (const task of tasks) {
    next = calculateFatigue(person, next, task);
  }

  return next;
};

const evaluateTaskFit = (person: Person, task: Task) => {
  const strain =
    task.demand_tech * person.modifiers.tech +
    task.demand_analysis * person.modifiers.analysis +
    task.demand_social * person.modifiers.social +
    task.demand_emotional * person.modifiers.emotional +
    task.ambiguity * person.modifiers.ambiguity +
    task.urgency * person.modifiers.urgency;

  return clamp(Math.round(100 - strain * 4.6), 0, 100);
};

export const evaluateRound = (
  persons: Person[],
  personStates: PersonState[],
  unassignedTasks: Task[]
): RoundEvaluationBundle => {
  const personById = new Map(persons.map((person) => [person.id, person]));
  const fits: number[] = [];
  const loadValues: number[] = [];
  const burnouts: string[] = [];
  const insights: string[] = [];

  let assignedCount = 0;
  let mismatchCount = 0;
  let technicalMismatchCount = 0;
  let overloadWarnings = 0;
  let roleMatchCount = 0;
  let riskPenalty = 0;

  for (const state of personStates) {
    const person = personById.get(state.id);
    if (!person) continue;

    const maxFatigue = Math.max(state.fatigue_cognitive, state.fatigue_emotional, state.fatigue_time);
    loadValues.push(maxFatigue);

    const maxTasks = person.hard_constraints?.max_active_tasks ?? Number.POSITIVE_INFINITY;
    if (state.assignedTasks.length > maxTasks || maxFatigue >= 97) {
      burnouts.push(person.name);
      overloadWarnings += 1;
    } else if (maxFatigue >= 82) {
      overloadWarnings += 1;
    }

    for (const task of state.assignedTasks) {
      assignedCount += 1;
      const fit = evaluateTaskFit(person, task);
      fits.push(fit);

      const roleHintMatch =
        (task.demand_tech + task.demand_analysis >= task.demand_social + task.demand_emotional &&
          person.modifiers.analysis <= 1.05 &&
          person.modifiers.tech <= 1.05) ||
        (task.demand_social + task.demand_emotional > task.demand_tech + task.demand_analysis &&
          person.modifiers.social <= 1.05 &&
          person.modifiers.emotional <= 1.05);

      if (roleHintMatch) roleMatchCount += 1;
      if (fit < 45) mismatchCount += 1;
      if (task.demand_tech >= 4 && person.modifiers.tech > 1.25) technicalMismatchCount += 1;

      if (task.risk_if_wrong >= 4 && fit < 55) {
        riskPenalty += (60 - fit) * 0.8;
      }
      if (task.urgency >= 4 && maxFatigue > 90) {
        riskPenalty += 6;
      }
    }
  }

  const totalTasks = assignedCount + unassignedTasks.length;

  if (assignedCount === 0) {
    return {
      result: {
        fitScore: 0,
        complianceScore: 0,
        balanceScore: 0,
        riskScore: 0,
        totalScore: 0,
        insights: ['No se asignó ninguna tarea. La ronda queda en 0 por falta total de ejecución.'],
        burnouts,
      },
      counters: {
        assignedCount: 0,
        totalTasks,
        roleMatchCount: 0,
        mismatchCount: 0,
        technicalMismatchCount: 0,
        overloadWarnings: 0,
        pendingCount: unassignedTasks.length,
        avgLoad: 0,
      },
    };
  }

  const pendingRatio = totalTasks ? unassignedTasks.length / totalTasks : 1;
  const fitScore = assignedCount ? Math.round(avg(fits)) : 0;
  const complianceScore = totalTasks ? Math.round((assignedCount / totalTasks) * 100) : 0;
  const balanceScore = Math.round(clamp(100 - stdDev(loadValues) * 1.6 - overloadWarnings * 8, 0, 100));
  const riskScore = Math.round(
    clamp(100 - riskPenalty - unassignedTasks.length * 14 - mismatchCount * 6 - technicalMismatchCount * 8, 0, 100)
  );

  let totalScore = Math.round(
    clamp(fitScore * 0.32 + complianceScore * 0.3 + balanceScore * 0.18 + riskScore * 0.2, 0, 100)
  );

  if (pendingRatio >= 0.5) totalScore = Math.min(totalScore, 28);
  else if (pendingRatio >= 0.34) totalScore = Math.min(totalScore, 46);

  if (mismatchCount >= Math.max(2, Math.ceil(assignedCount * 0.4))) totalScore = Math.min(totalScore, 52);
  if (burnouts.length > 0) totalScore = Math.min(totalScore, 45);

  if (complianceScore >= 90) insights.push('Cobertura alta: casi todas las tareas quedaron asignadas.');
  else insights.push('Quedaron tareas sin dueño; esto baja cumplimiento operativo.');

  if (mismatchCount === 0) insights.push('Buen criterio de asignación: no se detectaron desajustes críticos.');
  else insights.push(`Se detectaron ${mismatchCount} asignaciones con fit bajo.`);

  if (technicalMismatchCount > 0) insights.push(`Hay ${technicalMismatchCount} asignaciones técnicas con riesgo de ejecución.`);
  if (overloadWarnings > 0) insights.push('La carga se concentró demasiado en parte del equipo.');

  const result: RoundResult = {
    fitScore,
    complianceScore,
    balanceScore,
    riskScore,
    totalScore,
    insights: insights.slice(0, 4),
    burnouts,
  };

  const counters: RoundCounters = {
    assignedCount,
    totalTasks,
    roleMatchCount,
    mismatchCount,
    technicalMismatchCount,
    overloadWarnings,
    pendingCount: unassignedTasks.length,
    avgLoad: Math.round(avg(loadValues)),
  };

  return { result, counters };
};

export const applyRecovery = (states: PersonState[]): PersonState[] =>
  states.map((state) => {
    const recoveredCognitive = clamp(state.fatigue_cognitive * 0.72, 0, 100);
    const recoveredEmotional = clamp(state.fatigue_emotional * 0.68, 0, 100);
    const recoveredTime = clamp(state.fatigue_time * 0.74, 0, 100);

    return {
      ...state,
      fatigue_cognitive: Number(recoveredCognitive.toFixed(1)),
      fatigue_emotional: Number(recoveredEmotional.toFixed(1)),
      fatigue_time: Number(recoveredTime.toFixed(1)),
      base_fatigue_cognitive: Number(recoveredCognitive.toFixed(1)),
      base_fatigue_emotional: Number(recoveredEmotional.toFixed(1)),
      base_fatigue_time: Number(recoveredTime.toFixed(1)),
      assignedTasks: [],
    };
  });
