export type DemandType = 'tech' | 'analysis' | 'social' | 'emotional';

export interface Task {
  id: string;
  title: string;
  description: string;
  demand_tech: number;
  demand_analysis: number;
  demand_social: number;
  demand_emotional: number;
  ambiguity: number;
  urgency: number;
  duration_points: number;
  switching_penalty: number;
  risk_if_wrong: number;
  stakeholder_exposure: 'bajo' | 'medio' | 'alto';
}

export interface Person {
  id: string;
  name: string;
  role: string;
  description: string;
  modifiers: {
    tech: number;
    analysis: number;
    social: number;
    emotional: number;
    ambiguity: number;
    urgency: number;
  };
  hard_constraints?: {
    max_active_tasks?: number;
  };
}

export interface PersonState {
  id: string;
  fatigue_cognitive: number;
  fatigue_emotional: number;
  fatigue_time: number;
  base_fatigue_cognitive: number;
  base_fatigue_emotional: number;
  base_fatigue_time: number;
  assignedTasks: Task[];
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  round: number;
  effect: (tasks: Task[]) => Task[];
}

export interface RoundResult {
  fitScore: number;
  complianceScore: number;
  balanceScore: number;
  riskScore: number;
  totalScore: number;
  insights: string[];
  burnouts: string[];
}

export interface RoundCounters {
  assignedCount: number;
  totalTasks: number;
  roleMatchCount: number;
  mismatchCount: number;
  technicalMismatchCount: number;
  overloadWarnings: number;
  pendingCount: number;
  avgLoad: number;
}

export interface RoundEvaluationBundle {
  result: RoundResult;
  counters: RoundCounters;
}
