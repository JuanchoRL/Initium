export type GameId = 'personality' | 'memory' | 'leadership' | 'problemSolving' | 'ethics' | 'risk' | 'network' | 'strategy';
export type Stage = 'login' | 'consent' | 'welcome' | 'contextIntro' | 'instructions' | 'betweenGames' | 'playing' | 'results';
export type AccessType = 'candidate' | 'recruiter';
export type TransitionMap<T extends string> = Record<T, readonly T[]>;

export type CandidateProfile = {
  name: string;
  email: string;
  role: string;
  accessType: AccessType;
  inviteId?: string;
  acceptedTerms: boolean;
  acceptedDataPolicy: boolean;
};

export type GameMetrics = Record<string, number | string | boolean>;
export type GameResult = { score: number; metrics: GameMetrics };
export type ScoresMap = Record<GameId, number>;
export type MetricsMap = Record<GameId, GameMetrics>;

export type TelemetryEvent = {
  event: string;
  ts: number;
  gameId?: GameId;
  payload?: Record<string, unknown>;
};

export type ResumeSnapshot = {
  stage: Stage;
  currentGameIndex: number;
  candidate: CandidateProfile;
  scores: ScoresMap;
  metrics: MetricsMap;
  strategyProfile: string;
  personalityProfile: string;
  completedGameDurationsSec?: Partial<Record<GameId, number>>;
  createdAt: number;
};

export type SeenTutorialMap = Partial<Record<GameId, boolean>>;

export type AllocationKey = 'ops' | 'staff' | 'data' | 'rd';
export type AllocationMap = Record<AllocationKey, number>;
