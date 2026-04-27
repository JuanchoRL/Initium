'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { clamp, maskEmail, toSafeNumber } from '@/lib/math';
import { useStateMachine } from '@/lib/hooks/useFlowState';
import { useTelemetry, useStableSessionId } from '@/lib/telemetry';
import { persistAssessmentResult } from '@/lib/assessment-results/api';
import { startRecruiterAccess } from '@/lib/admin-dashboard/api';
import { clearRecruiterAccessSession, writeRecruiterAccessSession } from '@/lib/admin-dashboard/recruiter-session';
import { buildAssessmentSummary } from '@/lib/admin-dashboard/storage';

import {
  STORAGE_KEY,
  TUTORIALS_STORAGE_KEY,
  STAGE_TRANSITIONS,
  GAME_DEFS,
  EMPTY_SCORES,
  EMPTY_METRICS,
  DEBUG_RESULTS_FIXTURE,
  PERFORMANCE_GAME_IDS,
} from '@/lib/constants';
import type { Stage, GameId, GameResult, CandidateProfile, ScoresMap, MetricsMap, SeenTutorialMap, ResumeSnapshot, AccessType } from '@/lib/types';
import type { AssessmentInvite } from '@/types/admin-dashboard';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoginScreen } from '@/components/screens/LoginScreen';
import { ConsentScreen } from '@/components/screens/ConsentScreen';
import { WelcomeScreen } from '@/components/screens/WelcomeScreen';
import { ContextIntroScreen } from '@/components/transitions/ContextIntroScreen';
import { BetweenGamesTransitionScreen, BETWEEN_GAME_LINES } from '@/components/transitions/BetweenGamesTransitionScreen';
import { ResultsDashboard } from '@/components/dashboard/ResultsDashboard';

import { GamePersonality } from '@/app/games/personality/GamePersonality';
import { resolvePersonalitySummary, resolveEnrichedPersonality } from '@/lib/assessment/personality';
import { buildSignalQuality } from '@/lib/assessment/signal-confidence';
import { GameMemory } from '@/app/games/memory/GameMemory';
import GameLeadershipV2 from '@/app/games/leadership-v2/GameLeadershipV2';
import { GameProblemSolving } from '@/app/games/problem-solving/GameProblemSolving';
import GameEthicsAudit from '@/app/games/ethics-os/GameEthicsAudit';
import { GameNetwork } from '@/app/games/network/GameNetwork';
import { GameRisk } from '@/app/games/risk/GameRisk';
import { GameStrategy } from '@/app/games/strategy/GameStrategy';

export default function Page() {
  const router = useRouter();
  const params = useParams();
  const sessionId = useStableSessionId();
  const [stage, transitionStage] = useStateMachine<Stage>('login', STAGE_TRANSITIONS, 'pageStage');
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [scores, setScores] = useState<ScoresMap>(EMPTY_SCORES);
  const [metrics, setMetrics] = useState<MetricsMap>(EMPTY_METRICS);
  const [strategyProfile, setStrategyProfile] = useState('');
  const [personalityProfile, setPersonalityProfile] = useState('');
  const [, setSeenTutorials] = useState<SeenTutorialMap>({});
  const [inviteContext, setInviteContext] = useState<AssessmentInvite | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [completedGameDurationsSec, setCompletedGameDurationsSec] = useState<Partial<Record<GameId, number>>>({});
  const [playingClockTick, setPlayingClockTick] = useState(0);
  const isDebugGameMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('debug_game');
  }, []);

  const resumeRef = useRef<ResumeSnapshot | null>(null);
  const activeGameStartedAtRef = useRef<number | null>(null);
  const [canResume, setCanResume] = useState(false);

  const telemetry = useTelemetry(sessionId, candidate);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [stage]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ResumeSnapshot;
      if (parsed?.candidate && typeof parsed?.currentGameIndex === 'number') {
        resumeRef.current = parsed;
        setCanResume(true);
      }
    } catch {
      resumeRef.current = null;
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteId = urlParams.get('invite') || urlParams.get('inviteId');
    if (!inviteId) return;

    let cancelled = false;
    fetch(`/api/assessment-invites/${encodeURIComponent(inviteId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as { invite?: AssessmentInvite; error?: string };
        if (!response.ok || !data.invite) throw new Error(data.error || 'No se pudo cargar la invitación');
        return data.invite;
      })
      .then((invite) => {
        if (cancelled) return;
        setInviteContext(invite);
        if (invite.status !== 'sent') {
          setInviteError('Esta invitación ya no está activa. Pide a la empresa un nuevo enlace de evaluación.');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setInviteError(error instanceof Error ? error.message : 'No se pudo cargar la invitación');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TUTORIALS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SeenTutorialMap;
      setSeenTutorials(parsed || {});
    } catch {
      setSeenTutorials({});
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debugStage = params.get('debug_stage');
    if (debugStage !== 'results') return;

    const debugAccess: AccessType = params.get('debug_access') === 'recruiter' ? 'recruiter' : 'candidate';
    const fixture = DEBUG_RESULTS_FIXTURE;

    const buildDebugCandidate = (accessType: AccessType): CandidateProfile => ({
      name: 'Debug Candidate',
      email: 'debug@initium.local',
      role: 'QA',
      accessType,
      acceptedTerms: true,
      acceptedDataPolicy: true,
    });

    setCandidate(buildDebugCandidate(debugAccess));
    setCurrentGameIndex(GAME_DEFS.length - 1);
    setScores({ ...fixture.scores } as ScoresMap);
    setMetrics({ ...fixture.metrics } as MetricsMap);
    setStrategyProfile(fixture.strategyProfile);
    setPersonalityProfile(fixture.personalityProfile);
    setCompletedGameDurationsSec({ ...fixture.completedGameDurationsSec });
    transitionStage('results', { force: true });
    setCanResume(false);

    telemetry.track('debug_stage_boot', { stage: 'results', accessType: debugAccess });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug_stage')) return;
    const debugGame = params.get('debug_game');
    if (!debugGame) return;
    const gameIndex = GAME_DEFS.findIndex((game) => game.id === debugGame);
    if (gameIndex < 0) return;

    setCandidate({
      name: 'Debug Candidate',
      email: 'debug@initium.local',
      role: 'QA',
      accessType: 'candidate',
      acceptedTerms: true,
      acceptedDataPolicy: true,
    });
    setCurrentGameIndex(gameIndex);
    transitionStage('playing', { force: true });
    setCanResume(false);
    telemetry.track('debug_game_boot', { gameId: debugGame });
  }, []);

  useEffect(() => {
    if (stage !== 'playing') return;
    if (!activeGameStartedAtRef.current) {
      activeGameStartedAtRef.current = Date.now();
    }
    const timer = window.setInterval(() => {
      setPlayingClockTick((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  const saveProgress = useCallback(
    (source: 'manual' | 'auto') => {
      if (!candidate) return;
      if (!['consent', 'welcome', 'contextIntro', 'instructions', 'betweenGames', 'playing'].includes(stage)) return;

      const snapshot: ResumeSnapshot = {
        stage,
        currentGameIndex,
        candidate,
        scores,
        metrics,
        strategyProfile,
        personalityProfile,
        completedGameDurationsSec,
        createdAt: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      if (source === 'manual') {
        telemetry.track('progress_saved', { stage, currentGameIndex });
      }
    },
    [candidate, stage, currentGameIndex, scores, metrics, strategyProfile, personalityProfile, completedGameDurationsSec, telemetry]
  );

  useEffect(() => {
    saveProgress('auto');
  }, [saveProgress]);

  const markTutorialSeen = useCallback((gameId: GameId) => {
    setSeenTutorials((prev) => {
      if (prev[gameId]) return prev;
      const next = { ...prev, [gameId]: true };
      try {
        localStorage.setItem(TUTORIALS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (stage !== 'instructions') return;
    const gameId = GAME_DEFS[currentGameIndex]?.id;
    if (!gameId) return;

    const timerId = window.setTimeout(() => {
      markTutorialSeen(gameId);
      transitionStage('playing');
      telemetry.track('game_started', { gameIndex: currentGameIndex }, gameId);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [currentGameIndex, markTutorialSeen, stage, telemetry.track, transitionStage]);

  const resumeSession = () => {
    const snapshot = resumeRef.current;
    if (!snapshot) return;
    const safeGameIndex = clamp(snapshot.currentGameIndex, 0, GAME_DEFS.length - 1);
    const restoredGameId = GAME_DEFS[safeGameIndex]?.id;
    const restoredStage =
      snapshot.stage === 'instructions' && restoredGameId === 'personality' ? 'playing' : snapshot.stage;

    const restoredCandidate = snapshot.candidate as Partial<CandidateProfile>;
    setCandidate({
      name: restoredCandidate.name || 'Candidato',
      email: restoredCandidate.email || '',
      role: restoredCandidate.role || '',
      accessType: restoredCandidate.accessType === 'recruiter' ? 'recruiter' : 'candidate',
      inviteId: restoredCandidate.inviteId,
      acceptedTerms: Boolean(restoredCandidate.acceptedTerms),
      acceptedDataPolicy: Boolean(restoredCandidate.acceptedDataPolicy),
    });
    transitionStage(restoredStage, { force: true });
    setCurrentGameIndex(safeGameIndex);
    setScores({ ...EMPTY_SCORES, ...snapshot.scores });
    setMetrics({ ...EMPTY_METRICS, ...snapshot.metrics });
    setStrategyProfile(snapshot.strategyProfile);
    setPersonalityProfile(resolvePersonalitySummary(snapshot.metrics?.personality as Record<string, any>, snapshot.personalityProfile || '').profile);
    setCompletedGameDurationsSec(snapshot.completedGameDurationsSec || {});
    activeGameStartedAtRef.current = null;
    telemetry.track('session_resumed', { stage: restoredStage, currentGameIndex: safeGameIndex });
    setCanResume(false);
  };

  const resetAll = () => {
    transitionStage('login', { force: true });
    setCandidate(null);
    setCurrentGameIndex(0);
    setScores(EMPTY_SCORES);
    setMetrics(EMPTY_METRICS);
    setStrategyProfile('');
    setPersonalityProfile('');
    setCompletedGameDurationsSec({});
    activeGameStartedAtRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    telemetry.track('session_reset');
  };

  const handleGameComplete = useCallback(
    (result: GameResult) => {
      const gameId = GAME_DEFS[currentGameIndex].id;
      const nextScores = { ...scores, [gameId]: result.score };
      const nextMetrics = { ...metrics, [gameId]: result.metrics };

      markTutorialSeen(gameId);
      setScores(nextScores);
      setMetrics(nextMetrics);

      const startedAt = activeGameStartedAtRef.current;
      if (startedAt) {
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        setCompletedGameDurationsSec((prev) => ({ ...prev, [gameId]: durationSec }));
      }
      activeGameStartedAtRef.current = null;

      telemetry.track(
        'game_completed',
        {
          score: result.score,
          metrics: result.metrics,
        },
        gameId
      );

      if (currentGameIndex < GAME_DEFS.length - 1) {
        const nextIndex = currentGameIndex + 1;
        const fromGame = GAME_DEFS[currentGameIndex];
        const toGame = GAME_DEFS[nextIndex];
        setCurrentGameIndex(nextIndex);
        transitionStage('betweenGames');
        telemetry.track('transition_started', {
          from: fromGame.id,
          to: toGame.id,
        });
        return;
      }

      transitionStage('results');
      telemetry.track('session_completed', {
        overall: Math.round(
          PERFORMANCE_GAME_IDS.reduce((sum, currentTarget) => sum + toSafeNumber(nextScores[currentTarget], 0), 0) /
            PERFORMANCE_GAME_IDS.length
        ),
      });
      if (candidate && candidate.accessType === 'candidate' && !candidate.email.endsWith('@initium.local')) {
        const summary = buildAssessmentSummary(nextScores as Record<string, number>);
        const resolvedPersonality = resolveEnrichedPersonality(
          nextMetrics as Record<string, Record<string, number | string | boolean>>,
          personalityProfile
        );
        const signalQuality = buildSignalQuality(nextScores as ScoresMap, nextMetrics as MetricsMap);
        void persistAssessmentResult({
          id: sessionId,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          role: candidate.role,
          completedAt: new Date().toISOString(),
          strategyProfile,
          personalityProfile: resolvedPersonality.profile,
          personalitySubtype: resolvedPersonality.subtype,
          inviteId: candidate.inviteId,
          scores: nextScores as Record<string, number>,
          metrics: {
            ...(nextMetrics as Record<string, Record<string, number | string | boolean>>),
            signalQuality: {
              score: signalQuality.score,
              label: signalQuality.label,
              summary: signalQuality.summary,
            },
          },
          totalScore: summary.totalScore,
          technicalScore: summary.technicalScore,
          cognitiveScore: summary.cognitiveScore,
          softSkillsScore: summary.softSkillsScore,
          fitScores: summary.fitScores,
        }).catch((error) => {
          console.error('Failed to persist assessment result', error);
        });
      }
      localStorage.removeItem(STORAGE_KEY);
    },
    [candidate, currentGameIndex, markTutorialSeen, metrics, personalityProfile, scores, sessionId, strategyProfile, telemetry, transitionStage]
  );

  const gameTrack = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      const gameId = GAME_DEFS[currentGameIndex].id;
      telemetry.track(event, payload, gameId);
    },
    [currentGameIndex, telemetry.track]
  );

  const renderGame = () => {
    const gameId = GAME_DEFS[currentGameIndex].id;

    if (gameId === 'personality') {
      return (
        <GamePersonality
          onComplete={handleGameComplete}
          track={gameTrack}
          setPersonalityProfile={setPersonalityProfile}
        />
      );
    }
    if (gameId === 'memory') return <GameMemory onComplete={handleGameComplete} track={gameTrack} tutorialEnabled={!isDebugGameMode} />;
    if (gameId === 'leadership') return <GameLeadershipV2 onComplete={handleGameComplete} track={gameTrack} />;
    if (gameId === 'problemSolving') {
      return (
        <GameProblemSolving
          onComplete={handleGameComplete}
          track={gameTrack}
          candidateRole={candidate?.role || ''}
        />
      );
    }
    if (gameId === 'ethics') {
      return (
        <GameEthicsAudit
          onComplete={handleGameComplete}
          track={gameTrack}
          onGameComplete={(endingId) => gameTrack('ethics_ending_emitted', { endingId })}
        />
      );
    }
    if (gameId === 'risk') return <GameRisk onComplete={handleGameComplete} track={gameTrack} tutorialEnabled={!isDebugGameMode} />;
    if (gameId === 'network') return <GameNetwork onComplete={handleGameComplete} track={gameTrack} tutorialEnabled={!isDebugGameMode} />;
    if (gameId === 'strategy') {
      return (
        <GameStrategy
          onComplete={handleGameComplete}
          track={gameTrack}
          setStrategyProfile={setStrategyProfile}
        />
      );
    }
    return null;
  };

  const renderContent = () => {
    if (stage === 'login') {
      return (
        <LoginScreen
          canResume={canResume}
          onResume={resumeSession}
          initialData={
            inviteContext
              ? {
                  name: inviteContext.candidateName,
                  email: inviteContext.candidateEmail,
                  role: inviteContext.vacancy,
                  accessType: 'candidate',
                }
              : undefined
          }
          notice={
            inviteError ??
            (inviteContext?.status === 'sent'
              ? `Invitación para ${inviteContext.vacancy}. Tus resultados quedarán vinculados al dashboard recruiter.`
              : null)
          }
          onSubmit={async (data) => {
            telemetry.track('session_started', {
              role: data.role,
              accessType: data.accessType,
              emailMasked: maskEmail(data.email),
            });

            if (data.accessType === 'recruiter') {
              try {
                const response = await startRecruiterAccess({
                  name: data.name,
                  email: data.email,
                });
                writeRecruiterAccessSession(response.session);
              } catch (error) {
                console.error('Failed to persist recruiter login', error);
                writeRecruiterAccessSession({
                  name: data.name,
                  email: data.email,
                });
              }
              const locale = params?.locale || 'es';
              router.push(`/${locale}/admin`);
              return;
            }

            clearRecruiterAccessSession();
            const nextCandidate: CandidateProfile = {
              ...data,
              inviteId: inviteContext?.status === 'sent' ? inviteContext.id : undefined,
              acceptedTerms: false,
              acceptedDataPolicy: false,
            };
            setCandidate(nextCandidate);
            transitionStage('consent');
          }}
        />
      );
    }

    if (!candidate) return null;

    if (stage === 'consent') {
      return (
        <ConsentScreen
          candidate={candidate}
          onBack={() => transitionStage('login')}
          onConfirm={(nextCandidate) => {
            setCandidate(nextCandidate);
            transitionStage('welcome');
            telemetry.track('consent_confirmed', {
              acceptedTerms: nextCandidate.acceptedTerms,
              acceptedDataPolicy: nextCandidate.acceptedDataPolicy,
            });
          }}
        />
      );
    }

    if (stage === 'welcome') {
      return (
        <WelcomeScreen
          candidate={candidate}
          onStart={() => {
            if (currentGameIndex === 0) {
              transitionStage('contextIntro');
              telemetry.track('context_intro_started');
              return;
            }
            transitionStage('instructions');
            telemetry.track('assessment_started');
          }}
        />
      );
    }

    if (stage === 'contextIntro') {
      return (
        <ContextIntroScreen
          onComplete={() => {
            transitionStage('playing');
            markTutorialSeen('personality');
            telemetry.track('context_intro_completed');
            telemetry.track('assessment_started');
            telemetry.track('game_started', { gameIndex: 0 }, 'personality');
          }}
        />
      );
    }

    if (stage === 'instructions') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (stage === 'betweenGames') {
      const nextGame = GAME_DEFS[currentGameIndex];
      const previousGame = GAME_DEFS[Math.max(0, currentGameIndex - 1)];
      const transitionLineIndex = (currentGameIndex - 1 + BETWEEN_GAME_LINES.length) % BETWEEN_GAME_LINES.length;
      const transitionLine = BETWEEN_GAME_LINES[transitionLineIndex];

      return (
        <BetweenGamesTransitionScreen
          fromTitle={previousGame.title}
          toTitle={nextGame.title}
          line={transitionLine}
          lineIndex={transitionLineIndex}
          onComplete={() => {
            transitionStage('instructions');
            telemetry.track('transition_completed', { from: previousGame.id, to: nextGame.id });
          }}
        />
      );
    }

    if (stage === 'playing') {
      return renderGame();
    }

    if (stage === 'results') {
      return (
        <ResultsDashboard
          candidate={candidate}
          scores={scores}
          metrics={metrics}
          strategyProfile={strategyProfile}
          personalityProfile={personalityProfile}
          onRestart={resetAll}
        />
      );
    }

    return null;
  };

  const showProgress =
    stage === 'contextIntro' || stage === 'instructions' || stage === 'betweenGames' || stage === 'playing';

  const estimatedRemainingSec = useMemo(() => {
    const futureSec = GAME_DEFS.slice(currentGameIndex + 1).reduce((sum, game) => sum + game.estSec, 0);
    const currentGameEstSec = GAME_DEFS[currentGameIndex]?.estSec || 0;
    const currentElapsedSec =
      stage === 'playing' && activeGameStartedAtRef.current
        ? Math.floor((Date.now() - activeGameStartedAtRef.current) / 1000)
        : 0;
    const currentSec = stage === 'playing' ? Math.max(0, currentGameEstSec - currentElapsedSec) : currentGameEstSec;
    const baseRemainingSec = currentSec + futureSec;

    const entries = Object.entries(completedGameDurationsSec) as Array<[GameId, number]>;
    if (!entries.length) return baseRemainingSec;

    const estimatedCompletedSec = entries.reduce((sum, [gameId]) => {
      const def = GAME_DEFS.find((game) => game.id === gameId);
      return sum + (def?.estSec || 0);
    }, 0);
    if (!estimatedCompletedSec) return baseRemainingSec;

    const actualCompletedSec = entries.reduce((sum, [, sec]) => sum + sec, 0);
    const paceRatio = clamp(actualCompletedSec / estimatedCompletedSec, 0.7, 1.65);
    return Math.max(0, Math.round(baseRemainingSec * paceRatio));
  }, [completedGameDurationsSec, currentGameIndex, playingClockTick, stage]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 selection:bg-cyan-100 relative overflow-hidden print:overflow-visible">
      {/* Subtle Premium Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-sky-600/5 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute inset-0 bg-stone-50/40 backdrop-blur-[2px] pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col print:block print:min-h-0">
        {showProgress ? (
          <ProgressBar
            currentStep={currentGameIndex}
            remainingSecOverride={estimatedRemainingSec}
            onSave={() => saveProgress('manual')}
          />
        ) : null}
        <div className="pb-12 flex-1 print:block">{renderContent()}</div>
      </div>

      <style jsx global>{`
        @keyframes fillBar {
          0% {
            width: 0%;
            opacity: 0.5;
          }
          70% {
            width: 85%;
            opacity: 1;
            background-color: #06b6d4;
          }
          75% {
            width: 90%;
            background-color: #ef4444;
          }
          100% {
            width: 90%;
            opacity: 0;
          }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
