import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/core';
import { clamp, avg, stdDev } from '@/lib/math';
import type { GameResult } from '@/lib/types';
import { useTutorial } from '@/lib/hooks/useTutorial';
import { TutorialOverlay } from '@/components/ui/TutorialOverlay';

type GameProps = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
  tutorialEnabled?: boolean;
};

type RiskScoringFunction = 'linear' | 'accelerated' | 'diminishing';
type RiskModelType = 'A' | 'B' | 'C';
type RiskRoundStatus = 'idle' | 'charging' | 'cashed_out' | 'exploded';

const riskCalculateBasePoints = (charge: number, base: number, type: RiskScoringFunction) => {
  const multiplier =
    type === 'linear' ? charge : type === 'accelerated' ? Math.pow(charge, 2) : Math.sqrt(charge);
  return Math.floor(base * multiplier);
};

const riskCheckExplosion = (
  model: RiskModelType,
  params: { a?: number; b?: number; hazardBase?: number; min?: number; max?: number },
  charge: number,
  dtSeconds: number,
  threshold: number,
  random: number
) => {
  if (model === 'A') {
    const a = params.a ?? 0.1;
    const b = params.b ?? 1.8;
    return random < 1 - Math.exp(-(a + b * charge) * dtSeconds);
  }
  if (model === 'B') {
    return charge >= threshold;
  }
  if (model === 'C') {
    const hazardBase = params.hazardBase ?? 0.2;
    return charge >= threshold || random < 1 - Math.exp(-hazardBase * dtSeconds);
  }
  return false;
};

export const GameRisk = ({ onComplete, track, tutorialEnabled = true }: GameProps) => {
  const config = useMemo(
    () => ({
      model: 'B' as RiskModelType,
      scoring: 'linear' as RiskScoringFunction,
      rounds: 10,
      practiceRounds: 3,
      basePoints: 120,
      maxDurationMs: 3400,
      params: {
        A: { a: 0.1, b: 2.0 },
        B: { min: 0.34, max: 0.93 },
        C: { min: 0.4, max: 0.95, hazardBase: 0.2 },
      },
    }),
    []
  );

  const [currentRound, setCurrentRound] = useState(1);
  const [isPractice, setIsPractice] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);
  const [charge, setCharge] = useState(0);
  const [roundStatus, setRoundStatus] = useState<RiskRoundStatus>('idle');
  const [earnedThisRound, setEarnedThisRound] = useState(0);
  const [optimalZone, setOptimalZone] = useState({ min: 0, max: 0 });
  const [optimalHit, setOptimalHit] = useState(false);

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const thresholdRef = useRef(1);

  const holdDurationsRef = useRef<number[]>([]);
  const releaseRatiosRef = useRef<number[]>([]);
  const roundPointsRef = useRef<number[]>([]);
  const explosionsRef = useRef(0);
  const optimalHitsRef = useRef(0);
  const totalPointsRef = useRef(0);
  const finishedRef = useRef(false);

  const tutorial = useTutorial([
    {
      id: 'step-risk-gauge',
      targetId: 'risk-gauge-container',
      title: 'Zona Óptima Celeste',
      description: 'Acumula puntos pero cuidado con exceder el límite. Si sueltas justo en la zona celeste antes de fallar, obtienes más puntos. Haz clic para continuar.',
      actionRequired: 'custom',
      animationType: 'click',
    },
    {
      id: 'step-risk-hold',
      targetId: 'risk-charge-btn',
      title: 'Tolerancia al Riesgo',
      description: 'Mantén presionado para cargar. Suelta para sumar a tu evaluación.',
      actionRequired: 'custom',
      animationType: 'click',
    }
  ], tutorialEnabled);

  const setupNextRound = useCallback(() => {
    setCharge(0);
    setEarnedThisRound(0);
    setOptimalHit(false);
    setRoundStatus('idle');

    if (config.model === 'B' || config.model === 'C') {
      const modelParams = config.params[config.model];
      let minThreshold = modelParams.min;
      let maxThreshold = modelParams.max;

      if (isPractice) {
        if (currentRound === 1) {
          minThreshold = 0.72;
          maxThreshold = 0.95;
        } else if (currentRound === 2) {
          minThreshold = 0.58;
          maxThreshold = 0.92;
        } else {
          minThreshold = Math.max(modelParams.min, 0.46);
          maxThreshold = modelParams.max;
        }
      }

      thresholdRef.current = minThreshold + Math.random() * (maxThreshold - minThreshold);
    } else {
      thresholdRef.current = 1;
    }

    const zoneWidth = isPractice ? (currentRound === 1 ? 0.18 : currentRound === 2 ? 0.16 : 0.14) : 0.12;
    const min = (isPractice ? 0.24 : 0.3) + Math.random() * 0.55;
    const max = min + zoneWidth;
    setOptimalZone({ min, max });
  }, [config.model, config.params, currentRound, isPractice]);

  const finalizeGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    const maxPossible = config.rounds * config.basePoints * 2;
    const pointScore = clamp(Math.round((totalPointsRef.current / maxPossible) * 100), 0, 100);
    const avgHold = Math.round(avg(holdDurationsRef.current));
    const avgReleaseRatio = Number(avg(releaseRatiosRef.current).toFixed(2));
    const optimalHitRate = Number((optimalHitsRef.current / config.rounds).toFixed(2));
    const normalizedRatios = releaseRatiosRef.current.map((value) => Math.min(value, 1.2));
    const timingDeviation = avg(normalizedRatios.map((value) => Math.abs(value - 0.86)));
    const timingScore = clamp(Math.round(100 - timingDeviation * 170), 0, 100);
    const consistencyScore = clamp(Math.round(100 - stdDev(normalizedRatios) * 140), 0, 100);
    const optimalScore = clamp(Math.round(optimalHitRate * 100), 0, 100);
    let score = clamp(
      Math.round(
        pointScore * 0.48 +
          optimalScore * 0.18 +
          timingScore * 0.19 +
          consistencyScore * 0.15 -
          explosionsRef.current * 7
      ),
      0,
      100
    );

    if (avgReleaseRatio < 0.58) score = Math.min(score, 38);
    if (optimalHitsRef.current === 0) score = Math.min(score, 52);
    if (explosionsRef.current >= 4) score = Math.min(score, 34);

    track('game_submitted', {
      score,
      total_points: totalPointsRef.current,
      explosions: explosionsRef.current,
      optimal_hits: optimalHitsRef.current,
      optimal_hit_rate: optimalHitRate,
      avg_hold_ms: avgHold,
      avg_release_ratio: avgReleaseRatio,
      point_score: pointScore,
      timing_score: timingScore,
      consistency_score: consistencyScore,
    });

    onComplete({
      score,
      metrics: {
        total_points: totalPointsRef.current,
        max_points: maxPossible,
        explosions: explosionsRef.current,
        optimal_hits: optimalHitsRef.current,
        optimal_hit_rate: optimalHitRate,
        avg_hold_ms: avgHold,
        avg_release_ratio: avgReleaseRatio,
        rounds: config.rounds,
        practice_rounds: config.practiceRounds,
      },
    });
  }, [config.basePoints, config.practiceRounds, config.rounds, onComplete, track]);

  const handleExplosion = useCallback(
    (finalCharge: number, didExplode: boolean) => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }

      const holdDuration = Math.round(performance.now() - startTimeRef.current);
      if (!isPractice) {
        holdDurationsRef.current.push(holdDuration);
        releaseRatiosRef.current.push(Number((finalCharge / Math.max(thresholdRef.current, 0.01)).toFixed(3)));
      }

      if (didExplode) {
        if (!isPractice) explosionsRef.current += 1;
        setEarnedThisRound(0);
        setOptimalHit(false);
        setRoundStatus('exploded');
        roundPointsRef.current.push(0);
        track('error_committed', {
          type: 'risk_explosion',
          round: currentRound,
          practice: isPractice,
          threshold: Number(thresholdRef.current.toFixed(3)),
          charge: Number(finalCharge.toFixed(3)),
        });
        return;
      }

      const basePoints = riskCalculateBasePoints(finalCharge, config.basePoints, config.scoring);
      const points = basePoints;
      setEarnedThisRound(points);
      roundPointsRef.current.push(points);
      if (!isPractice) {
        totalPointsRef.current += points;
        setTotalPoints(totalPointsRef.current);
      }
      setRoundStatus('cashed_out');
      track('decision_made', {
        type: 'risk_auto_cash_out',
        round: currentRound,
        practice: isPractice,
        points,
        charge: Number(finalCharge.toFixed(3)),
      });
    },
    [config.basePoints, config.scoring, currentRound, isPractice, track]
  );

  const gameLoop = useCallback(
    (time: number) => {
      if (finishedRef.current) return;
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
        requestRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const elapsedMs = time - startTimeRef.current;
      const dtSeconds = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const exactCharge = Math.min(1, elapsedMs / config.maxDurationMs);
      setCharge(exactCharge);

      const didExplode = riskCheckExplosion(
        config.model,
        config.params[config.model],
        exactCharge,
        dtSeconds,
        thresholdRef.current,
        Math.random()
      );

      if (didExplode || exactCharge >= 1) {
        handleExplosion(exactCharge, didExplode);
      } else {
        requestRef.current = requestAnimationFrame(gameLoop);
      }
    },
    [config.maxDurationMs, config.model, config.params, handleExplosion]
  );

  const startHold = useCallback(
    (event?: React.PointerEvent | KeyboardEvent) => {
      if (event && 'preventDefault' in event) event.preventDefault();
      if (finishedRef.current || roundStatus !== 'idle') return;

      if (tutorial.isActive) {
        tutorial.advanceStep();
      }

      setRoundStatus('charging');
      const now = performance.now();
      startTimeRef.current = now;
      lastTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(gameLoop);

      track('decision_made', { type: 'risk_hold_start', round: currentRound, practice: isPractice });
    },
    [currentRound, gameLoop, isPractice, roundStatus, track, tutorial]
  );

  const releaseHold = useCallback(() => {
    if (roundStatus !== 'charging') return;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    const holdDuration = Math.round(performance.now() - startTimeRef.current);
    if (!isPractice) holdDurationsRef.current.push(holdDuration);

    const currentCharge = charge;
    const basePts = riskCalculateBasePoints(currentCharge, config.basePoints, config.scoring);
    const isOptimal = currentCharge >= optimalZone.min && currentCharge <= optimalZone.max;
    const finalPoints = isOptimal ? basePts * 2 : basePts;

    if (!isPractice) {
      releaseRatiosRef.current.push(Number((currentCharge / Math.max(thresholdRef.current, 0.01)).toFixed(3)));
      if (isOptimal) optimalHitsRef.current += 1;
    }
    roundPointsRef.current.push(finalPoints);

    if (!isPractice) {
      totalPointsRef.current += finalPoints;
      setTotalPoints(totalPointsRef.current);
    }
    setOptimalHit(isOptimal);
    setEarnedThisRound(finalPoints);
    setRoundStatus('cashed_out');

    track('decision_made', {
      type: 'risk_cash_out',
      round: currentRound,
      practice: isPractice,
      charge: Number(currentCharge.toFixed(3)),
      threshold: Number(thresholdRef.current.toFixed(3)),
      optimal_hit: isOptimal,
      points: finalPoints,
      hold_ms: holdDuration,
    });
  }, [charge, config.basePoints, config.scoring, currentRound, isPractice, optimalZone.max, optimalZone.min, roundStatus, track]);

  const nextRound = useCallback(() => {
    if (isPractice) {
      if (currentRound >= config.practiceRounds) {
        setIsPractice(false);
        setCurrentRound(1);
        setCharge(0);
        setEarnedThisRound(0);
        setOptimalHit(false);
        setRoundStatus('idle');
        track('round_completed', { type: 'risk_practice_completed' });
        return;
      }
      setCurrentRound((value) => value + 1);
      return;
    }

    if (currentRound >= config.rounds) {
      finalizeGame();
      return;
    }
    setCurrentRound((value) => value + 1);
  }, [config.practiceRounds, config.rounds, currentRound, finalizeGame, isPractice, track]);

  useEffect(() => {
    setupNextRound();
  }, [currentRound, isPractice, setupNextRound]);

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    const onGlobalPointerUp = () => releaseHold();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        if (roundStatus === 'idle') {
          startHold(event);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        if (roundStatus === 'charging') {
          event.preventDefault();
          releaseHold();
        }
      }
    };

    if (roundStatus === 'charging') {
      window.addEventListener('pointerup', onGlobalPointerUp);
      window.addEventListener('pointercancel', onGlobalPointerUp);
    }
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [releaseHold, roundStatus, startHold]);

  const basePts = riskCalculateBasePoints(charge, config.basePoints, config.scoring);
  const isCharging = roundStatus === 'charging';
  const isOptimal = charge >= optimalZone.min && charge <= optimalZone.max;
  const isDanger = charge > optimalZone.max;
  const potentialPts = isOptimal ? basePts * 2 : basePts;
  const roundTotal = isPractice ? config.practiceRounds : config.rounds;
  const phaseLabel = isPractice ? 'Fase de prueba' : 'Evaluación principal';

  let progressColor = '#cbd5e1';
  if (isCharging) {
    if (isOptimal) progressColor = '#06b6d4';
    else if (isDanger) progressColor = '#ef4444';
    else progressColor = '#67e8f9';
  }

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - charge * circumference;
  const zoneLength = (optimalZone.max - optimalZone.min) * circumference;
  const zoneOffset = -(optimalZone.min * circumference);

  return (
    <div className="w-full max-w-5xl mx-auto pt-8 px-4 relative" data-testid="risk-game">
      <TutorialOverlay
        isActive={tutorial.isActive}
        targetRect={tutorial.targetRect}
        step={tutorial.currentStep}
      />
      {roundStatus === 'exploded' ? <div className="absolute inset-0 z-20 pointer-events-none risk-flash-red-overlay rounded-2xl" /> : null}
      {roundStatus === 'cashed_out' ? <div className="absolute inset-0 z-20 pointer-events-none risk-flash-cyan-overlay rounded-2xl" /> : null}

      <Card className="p-5 md:p-6 relative overflow-hidden" data-testid="risk-card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isPractice ? 'bg-amber-400' : 'bg-cyan-500'}`} />
              <span className="text-[10px] uppercase font-mono tracking-widest text-stone-400">{phaseLabel}</span>
            </div>
            <div className="text-[10px] uppercase font-mono tracking-widest text-stone-400 mb-1">Tolerancia al riesgo</div>
            <div className="text-sm font-semibold text-stone-700">
              Ronda {currentRound} <span className="text-stone-400">/ {roundTotal}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono tracking-widest text-stone-400 mb-1">Puntaje evaluado</div>
            <div className="text-3xl font-light text-stone-800">{totalPoints.toLocaleString()}</div>
          </div>
        </div>

        <div className="risk-fade-in flex flex-col items-center">
          <div className="h-24 flex items-end justify-center mb-4 w-full">
            {roundStatus === 'idle' ? (
              <div className="text-stone-400 font-light tracking-widest uppercase text-sm">
                {isPractice ? 'Ronda de prueba: calibra tu ritmo' : 'Esperando interacción'}
              </div>
            ) : null}

            {isCharging ? (
              <div className="flex flex-col items-center">
                <div
                  className={`text-6xl font-extralight tracking-tighter transition-colors duration-100 ${
                    isOptimal ? 'text-cyan-600 scale-105 transform' : isDanger ? 'text-red-500' : 'text-stone-800'
                  }`}
                >
                  {potentialPts}
                </div>
                {isOptimal ? (
                  <div className="text-cyan-600/90 text-[10px] font-mono uppercase tracking-widest mt-2 risk-pulse-subtle">
                    Multiplicador óptimo activo
                  </div>
                ) : null}
                {isDanger ? <div className="text-red-500/90 text-[10px] font-mono uppercase tracking-widest mt-2">Riesgo elevado</div> : null}
              </div>
            ) : null}

            {roundStatus === 'cashed_out' ? (
              <div className="text-center risk-fade-in">
                <div className="text-5xl font-light text-cyan-600">+{earnedThisRound}</div>
                <div className="text-stone-500 font-mono text-xs uppercase tracking-widest mt-3">
                  {optimalHit ? 'Zona óptima alcanzada' : 'Carga asegurada'}
                </div>
              </div>
            ) : null}

            {roundStatus === 'exploded' ? (
              <div className="text-center risk-fade-in">
                <div className="text-5xl font-light text-red-500">Fallo</div>
                <div className="text-stone-500 font-mono text-xs uppercase tracking-widest mt-3">Límite excedido</div>
              </div>
            ) : null}
          </div>

          <div 
            id="risk-gauge-container" 
            data-testid="risk-gauge"
            className={`relative flex items-center justify-center mb-8 ${tutorial.isActive && tutorial.currentStep?.id === 'step-risk-gauge' ? 'cursor-pointer' : ''}`} 
            style={{ width: '228px', height: '228px' }} 
            onClickCapture={() => {
              if (tutorial.isActive && tutorial.currentStep?.id === 'step-risk-gauge') {
                tutorial.advanceStep();
              }
            }}
          >
            <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="4.5" fill="none" />

              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={isOptimal && isCharging ? '#06b6d4' : '#bae6fd'}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${zoneLength} ${circumference}`}
                strokeDashoffset={zoneOffset}
                className="transition-all duration-300"
                style={{ opacity: 0.88 }}
              />

              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={progressColor}
                strokeWidth="4.5"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                className="transition-colors duration-100"
              />
            </svg>

            <div
              className="absolute rounded-full flex items-center justify-center flex-col transition-all duration-150"
              style={{
                width: '122px',
                height: '122px',
                backgroundColor: isCharging ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.85)',
                border: `1px solid ${isCharging ? (isOptimal ? '#06b6d4' : isDanger ? '#ef4444' : '#bae6fd') : '#e2e8f0'}`,
              }}
            >
              <span className="text-2xl font-light tracking-wide text-stone-700">
                {(charge * 100).toFixed(0)}
                <span className="text-sm text-stone-400 ml-1">%</span>
              </span>
            </div>
          </div>

          <div className="w-full max-w-xs h-16 flex items-center justify-center relative">
            {roundStatus === 'idle' || roundStatus === 'charging' ? (
              <button
                id="risk-charge-btn"
                onPointerDown={startHold}
                className={`
                  w-full h-14 rounded-full font-semibold text-sm tracking-widest uppercase transition-all duration-150 select-none border
                  ${
                    isCharging
                      ? 'bg-cyan-50 border-cyan-200 text-cyan-700 scale-95 risk-pulse-subtle'
                      : 'bg-cyan-600 text-white border-transparent hover:bg-cyan-500'
                  }
                `}
                style={{ touchAction: 'none' }}
              >
                {isCharging ? 'Cargando...' : 'Mantener presionado'}
              </button>
            ) : (
              <button
                onClick={nextRound}
                className="w-full h-14 bg-white text-cyan-700 rounded-full font-semibold text-sm hover:bg-cyan-50 transition-colors uppercase tracking-widest border border-cyan-200"
              >
                {isPractice
                  ? currentRound >= config.practiceRounds
                    ? 'Comenzar evaluación'
                    : 'Siguiente prueba'
                  : currentRound >= config.rounds
                    ? 'Ver resultado'
                    : 'Siguiente ronda'}
              </button>
            )}
          </div>

          <p className="text-stone-400 text-xs text-center mt-1">
            {isPractice
              ? 'Las rondas de prueba no suman al puntaje final.'
              : 'Suelta antes del fallo crítico. Consistencia > máximo puntual.'}
          </p>
        </div>
      </Card>

      <style jsx>{`
        @keyframes riskFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes riskPulseSubtle {
          0% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.04);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
        }
        @keyframes riskFlashRed {
          0% {
            background-color: rgba(239, 68, 68, 0.12);
          }
          100% {
            background-color: transparent;
          }
        }
        @keyframes riskFlashCyan {
          0% {
            background-color: rgba(6, 182, 212, 0.13);
          }
          100% {
            background-color: transparent;
          }
        }
        .risk-fade-in {
          animation: riskFadeIn 0.28s ease-out forwards;
        }
        .risk-pulse-subtle {
          animation: riskPulseSubtle 1.4s infinite ease-in-out;
        }
        .risk-flash-red-overlay {
          animation: riskFlashRed 0.38s ease-out forwards;
        }
        .risk-flash-cyan-overlay {
          animation: riskFlashCyan 0.38s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
