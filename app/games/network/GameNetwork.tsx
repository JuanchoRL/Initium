import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Disc } from 'lucide-react';
import { Card } from '@/components/ui/core';
import { clamp } from '@/lib/math';
import type { GameResult } from '@/lib/types';
import { useTutorial } from '@/lib/hooks/useTutorial';
import { TutorialOverlay } from '@/components/ui/TutorialOverlay';

type GameProps = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
  tutorialEnabled?: boolean;
};

type NetworkNode = {
  id: string;
  x: number;
  y: number;
  type: 'source' | 'switch' | 'station';
  next?: string;
  options?: string[];
  color?: string;
};

type NetworkPacket = {
  id: string;
  color: string;
  pos: { x: number; y: number };
  targetNode: string;
  prevNode: string;
  progress: number;
  baseSpeed: number;
  angle: number;
  scale: number;
  createdAt: number;
  switchesPassed: number;
};

type NetworkParticle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
};

const NETWORK_NODES: Record<string, NetworkNode> = {
  START: { id: 'START', x: 15, y: 50, next: 'J1', type: 'source' },
  J1: { id: 'J1', x: 30, y: 50, type: 'switch', options: ['J2', 'J3'] },
  J2: { id: 'J2', x: 30, y: 25, type: 'switch', options: ['S_BLUE', 'S_RED'] },
  S_BLUE: { id: 'S_BLUE', x: 10, y: 25, type: 'station', color: '#3b82f6' },
  S_RED: { id: 'S_RED', x: 55, y: 25, type: 'station', color: '#ef4444' },
  J3: { id: 'J3', x: 65, y: 50, type: 'switch', options: ['S_YELLOW', 'J4'] },
  S_YELLOW: { id: 'S_YELLOW', x: 90, y: 50, type: 'station', color: '#eab308' },
  J4: { id: 'J4', x: 65, y: 75, type: 'switch', options: ['S_GREEN', 'S_PURPLE'] },
  S_GREEN: { id: 'S_GREEN', x: 40, y: 75, type: 'station', color: '#22c55e' },
  S_PURPLE: { id: 'S_PURPLE', x: 90, y: 75, type: 'station', color: '#a855f7' },
};

const NETWORK_FLOW_COLORS = ['#3b82f6', '#ef4444', '#eab308', '#22c55e', '#a855f7'];
const NETWORK_SWITCH_IDS = Object.values(NETWORK_NODES)
  .filter((node) => node.type === 'switch')
  .map((node) => node.id);

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

export const GameNetwork = ({ onComplete, track, tutorialEnabled = true }: GameProps) => {
  const tutorial = useTutorial([
    {
      id: 'step-click-switch',
      targetId: 'network-board-container',
      title: 'Control de Flujo',
      description: 'Haz clic en las flechas para redirigir el color a su nodo correspondiente.',
      actionRequired: 'custom',
      animationType: 'none',
    }
  ], tutorialEnabled);

  const tutorialIsActiveRef = useRef(tutorial.isActive);
  useEffect(() => {
    tutorialIsActiveRef.current = tutorial.isActive;
  }, [tutorial.isActive]);

  const [gameState, setGameState] = useState<'playing' | 'finished'>('playing');
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [peakParallel, setPeakParallel] = useState(0);
  const [uiSwitches, setUiSwitches] = useState<Record<string, number>>({});
  const [uiPackets, setUiPackets] = useState<NetworkPacket[]>([]);
  const [uiParticles, setUiParticles] = useState<NetworkParticle[]>([]);

  const switchesRef = useRef<Record<string, number>>({});
  const packetsRef = useRef<NetworkPacket[]>([]);
  const particlesRef = useRef<NetworkParticle[]>([]);
  const scoreRef = useRef(0);
  const routedRef = useRef(0);
  const missedRef = useRef(0);
  const switchFlipsRef = useRef(0);
  const timelySwitchesRef = useRef(0);
  const proactiveSwitchesRef = useRef(0);
  const peakParallelRef = useRef(0);
  const finishedRef = useRef(false);
  const timeLeftRef = useRef(60);
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef({ lastRafTs: 0, simNowMs: 0, lastSpawnMs: 0, nextUiSyncMs: 0 });
  const stepSimulationRef = useRef<(deltaMs: number) => void>(() => {});

  const calculateAngleByIds = useCallback((fromId: string, toId: string) => {
    const from = NETWORK_NODES[fromId];
    const to = NETWORK_NODES[toId];
    if (!from || !to) return 0;
    return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, color: string, count = 6, spread = 0.045) => {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * spread + 0.02;
      particlesRef.current.push({
        id: `prt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.0017 + Math.random() * 0.0008,
        color,
        size: 0.45 + Math.random() * 1.5,
      });
    }
  }, []);

  const syncUi = useCallback(() => {
    setUiPackets([...packetsRef.current]);
    setUiParticles([...particlesRef.current]);
    setScore(scoreRef.current);
    setMistakes(missedRef.current);
    setPeakParallel(peakParallelRef.current);
    setLevel(clamp(Math.floor(scoreRef.current / 5) + 1, 1, 6));
  }, []);

  const finalizeGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setGameState('finished');

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const correctRoutes = routedRef.current;
    const wrongRoutes = missedRef.current;
    const totalRoutes = correctRoutes + wrongRoutes;
    const accuracy = totalRoutes > 0 ? correctRoutes / totalRoutes : 0;

    const activityScore = clamp(Math.round((totalRoutes / 16) * 100), 0, 100);
    const throughputScore = clamp(Math.round((correctRoutes / 20) * 100), 0, 100);
    const accuracyScore = clamp(Math.round(accuracy * 100), 0, 100);
    const multitaskScore = clamp(Math.round((peakParallelRef.current / 5) * 100), 0, 100);
    const switchQualityScore =
      switchFlipsRef.current > 0
        ? clamp(Math.round((timelySwitchesRef.current / switchFlipsRef.current) * 100), 0, 100)
        : 0;

    let finalScore = clamp(
      Math.round(
        throughputScore * 0.28 +
          accuracyScore * 0.32 +
          multitaskScore * 0.14 +
          switchQualityScore * 0.16 +
          activityScore * 0.1
      ),
      0,
      100
    );

    if (totalRoutes < 6) finalScore = Math.min(finalScore, 22);
    else if (totalRoutes < 10) finalScore = Math.min(finalScore, 40);
    if (correctRoutes < 5) finalScore = Math.min(finalScore, 28);
    if (accuracy < 0.5) finalScore = Math.min(finalScore, 36);
    if (switchFlipsRef.current < 2) finalScore = Math.min(finalScore, 30);

    track('game_submitted', {
      finalScore,
      correctRoutes,
      wrongRoutes,
      accuracy: Number(accuracy.toFixed(2)),
      activityScore,
      switchFlips: switchFlipsRef.current,
      timelySwitches: timelySwitchesRef.current,
      proactiveSwitches: proactiveSwitchesRef.current,
      peakParallel: peakParallelRef.current,
    });

    onComplete({
      score: finalScore,
      metrics: {
        correct_routes: correctRoutes,
        wrong_routes: wrongRoutes,
        accuracy: Number(accuracy.toFixed(2)),
        switch_flips: switchFlipsRef.current,
        timely_switches: timelySwitchesRef.current,
        proactive_switches: proactiveSwitchesRef.current,
        peak_parallel_packets: peakParallelRef.current,
        throughput_per_min: correctRoutes,
      },
    });
  }, [onComplete, track]);

  const stepSimulation = useCallback(
    (deltaMs: number) => {
      if (finishedRef.current) return;
      if (tutorialIsActiveRef.current) return;
      const frame = frameRef.current;
      frame.simNowMs += deltaMs;

      const nextTime = Math.max(0, 60 - Math.floor(frame.simNowMs / 1000));
      if (nextTime !== timeLeftRef.current) {
        timeLeftRef.current = nextTime;
        setTimeLeft(nextTime);
        if (nextTime === 0) {
          syncUi();
          finalizeGame();
          return;
        }
      }

      const currentLevel = clamp(Math.floor(scoreRef.current / 5) + 1, 1, 6);
      const speedMultiplier = currentLevel >= 5 ? 1.62 : currentLevel >= 3 ? 1.32 : 1;
      const spawnIntervalMs = Math.max(780, 2500 - currentLevel * 290);
      const maxConcurrentPackets = Math.min(7, 2 + Math.floor(currentLevel / 2));

      if (
        frame.simNowMs - frame.lastSpawnMs >= spawnIntervalMs &&
        packetsRef.current.length < maxConcurrentPackets
      ) {
        const color = NETWORK_FLOW_COLORS[Math.floor(Math.random() * NETWORK_FLOW_COLORS.length)];
        const startNode = NETWORK_NODES.START;
        const nextNodeId = startNode.next || 'J1';
        packetsRef.current.push({
          id: `pkt-${frame.simNowMs}-${Math.random().toString(16).slice(2)}`,
          color,
          pos: { x: startNode.x, y: startNode.y },
          targetNode: nextNodeId,
          prevNode: 'START',
          progress: 0,
          baseSpeed: (0.00039 + currentLevel * 0.00005) * speedMultiplier,
          angle: calculateAngleByIds('START', nextNodeId),
          scale: 0,
          createdAt: frame.simNowMs,
          switchesPassed: 0,
        });
        frame.lastSpawnMs = frame.simNowMs;
      }

      const updatedPackets: NetworkPacket[] = [];
      for (const packet of packetsRef.current) {
        const target = NETWORK_NODES[packet.targetNode];
        const prev = NETWORK_NODES[packet.prevNode];
        if (!target || !prev) continue;

        packet.progress += packet.baseSpeed * deltaMs;
        packet.scale = Math.min(1, packet.scale + 0.04);
        packet.pos.x = prev.x + (target.x - prev.x) * packet.progress;
        packet.pos.y = prev.y + (target.y - prev.y) * packet.progress;

        if (packet.progress >= 1) {
          if (target.type === 'station') {
            if (packet.color === target.color) {
              scoreRef.current += 1;
              routedRef.current += 1;
              spawnParticles(target.x, target.y, target.color || '#06b6d4', 10, 0.05);
            } else {
              missedRef.current += 1;
              track('error_committed', {
                type: 'network_wrong_station',
                packetColor: packet.color,
                stationColor: target.color,
              });
            }
            continue;
          }

          const nextNodeId =
            target.type === 'switch'
              ? target.options?.[switchesRef.current[target.id] ?? 0]
              : target.next;
          if (!nextNodeId || !NETWORK_NODES[nextNodeId]) continue;

          packet.prevNode = target.id;
          packet.targetNode = nextNodeId;
          packet.progress = 0;
          packet.angle = calculateAngleByIds(target.id, nextNodeId);
          if (target.type === 'switch') packet.switchesPassed += 1;
        }
        updatedPackets.push(packet);
      }
      packetsRef.current = updatedPackets;

      const updatedParticles: NetworkParticle[] = [];
      for (const particle of particlesRef.current) {
        particle.x += particle.vx * deltaMs;
        particle.y += particle.vy * deltaMs;
        particle.life -= particle.decay * deltaMs;
        if (particle.life > 0) updatedParticles.push(particle);
      }
      particlesRef.current = updatedParticles;

      peakParallelRef.current = Math.max(peakParallelRef.current, packetsRef.current.length);

      if (frame.simNowMs >= frame.nextUiSyncMs) {
        syncUi();
        frame.nextUiSyncMs = frame.simNowMs + 32;
      }
    },
    [calculateAngleByIds, finalizeGame, spawnParticles, syncUi, track]
  );

  useEffect(() => {
    stepSimulationRef.current = stepSimulation;
  }, [stepSimulation]);

  useEffect(() => {
    const initialSwitches: Record<string, number> = {};
    for (const switchId of NETWORK_SWITCH_IDS) initialSwitches[switchId] = 0;
    switchesRef.current = initialSwitches;
    setUiSwitches(initialSwitches);
    setUiPackets([]);
    setUiParticles([]);
    finishedRef.current = false;
    setGameState('playing');
    scoreRef.current = 0;
    routedRef.current = 0;
    missedRef.current = 0;
    switchFlipsRef.current = 0;
    timelySwitchesRef.current = 0;
    proactiveSwitchesRef.current = 0;
    peakParallelRef.current = 0;
    particlesRef.current = [];
    frameRef.current = { lastRafTs: 0, simNowMs: 0, lastSpawnMs: 0, nextUiSyncMs: 0 };
    timeLeftRef.current = 60;
    setTimeLeft(60);

    const animate = (ts: number) => {
      if (finishedRef.current) return;
      const frame = frameRef.current;
      if (!frame.lastRafTs) frame.lastRafTs = ts;
      const deltaMs = Math.min(64, ts - frame.lastRafTs);
      frame.lastRafTs = ts;
      stepSimulationRef.current(deltaMs);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.render_game_to_text = () =>
      JSON.stringify({
        mode: gameState,
        coordinate_system: {
          origin: 'top-left',
          x: 'right+',
          y: 'down+',
          units: 'svg percent (0-100)',
        },
        timeLeft,
        score: scoreRef.current,
        level: clamp(Math.floor(scoreRef.current / 5) + 1, 1, 6),
        switches: switchesRef.current,
        particles: particlesRef.current.length,
        packets: packetsRef.current.slice(0, 10).map((packet) => ({
          id: packet.id,
          color: packet.color,
          x: Number(packet.pos.x.toFixed(2)),
          y: Number(packet.pos.y.toFixed(2)),
          from: packet.prevNode,
          to: packet.targetNode,
          progress: Number(packet.progress.toFixed(2)),
        })),
      });

    window.advanceTime = (ms: number) => {
      const stepMs = 1000 / 60;
      const steps = Math.max(1, Math.round(ms / stepMs));
      for (let i = 0; i < steps; i += 1) stepSimulationRef.current(stepMs);
      syncUi();
    };

    return () => {
      window.render_game_to_text = undefined;
      window.advanceTime = undefined;
    };
  }, [gameState, timeLeft, syncUi]);

  const toggleSwitch = (switchId: string) => {
    if (gameState !== 'playing' || finishedRef.current) return;

    if (tutorial.isActive && tutorial.currentStep?.id === 'step-click-switch' && switchId === 'J1') {
      tutorial.advanceStep();
    }

    const node = NETWORK_NODES[switchId];
    if (!node || !node.options || !node.options.length) return;

    const currentIndex = switchesRef.current[switchId] ?? 0;
    const nextIndex = (currentIndex + 1) % node.options.length;
    switchesRef.current[switchId] = nextIndex;
    setUiSwitches({ ...switchesRef.current });

    switchFlipsRef.current += 1;
    const incoming = packetsRef.current
      .filter((packet) => packet.targetNode === switchId)
      .sort((a, b) => b.progress - a.progress)[0];

    if (incoming && incoming.progress >= 0.55) {
      timelySwitchesRef.current += 1;
      track('decision_made', {
        type: 'network_switch_flip_timed',
        switchId,
        packetProgress: Number(incoming.progress.toFixed(2)),
      });
    } else {
      proactiveSwitchesRef.current += 1;
      track('decision_made', { type: 'network_switch_flip_proactive', switchId });
    }
  };

  const networkPaceLabel = level >= 5 ? 'MAXIMO' : level >= 3 ? 'ALTO' : 'NORMAL';

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-6xl mx-auto animate-fade-in pt-4 px-4" data-testid="network-game">
      <div className="flex justify-between w-full px-5 py-3 bg-white rounded-xl border border-stone-200 shadow-sm gap-4" data-testid="network-hud">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Tiempo</span>
            <div className={`text-2xl font-mono font-bold ${timeLeft < 10 ? 'text-red-500' : 'text-stone-800'}`}>
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Sincronizados</span>
            <div className="text-2xl font-mono font-bold text-cyan-600">{score}</div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Nivel</span>
            <div className="text-4xl font-black italic leading-none text-stone-600">{networkPaceLabel}</div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Fase actual</span>
          <div className="text-5xl font-black italic leading-none text-stone-300">05</div>
        </div>
      </div>

      <Card id="network-board-container" className="w-full max-w-[1080px] mx-auto relative aspect-[16/9] overflow-hidden p-0 rounded-3xl border-2 border-white/60 bg-white/40 shadow-xl backdrop-blur-md" data-testid="network-board">
        <TutorialOverlay
          isActive={tutorial.isActive}
          targetRect={tutorial.targetRect}
          step={tutorial.currentStep}
        />
        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-lg p-3 rounded-2xl text-xs text-stone-500 border border-white/50 z-10 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Disc className="w-4 h-4 text-cyan-600" />
            <span className="font-bold text-stone-700">Control de Flujo</span>
          </div>
          Haz clic en los nodos para redirigir.
        </div>

        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
          <defs>
            <filter id="networkSoftShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.18" />
            </filter>
            <filter id="networkGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="networkBoardBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.8" />
            </linearGradient>
            <radialGradient id="nodeBase" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </radialGradient>
            <radialGradient id="nodeActiveGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="100" height="100" fill="url(#networkBoardBg)" />

          {Object.entries(NETWORK_NODES).map(([id, node]) => {
            const targets = node.options || (node.next ? [node.next] : []);
            return targets.map((targetId) => {
              const targetNode = NETWORK_NODES[targetId];
              if (!targetNode) return null;
              const isActive =
                node.type === 'source' ||
                (node.type === 'switch' && node.options?.[uiSwitches[id] ?? 0] === targetId);

              return (
                <g key={`network-path-${id}-${targetId}`}>
                  {/* Background track */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="#cbd5e1"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {/* Inner track */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="#f1f5f9"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Active glowing track */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke={isActive ? '#06b6d4' : 'transparent'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="transition-colors duration-300"
                    filter={isActive ? 'url(#networkGlow)' : undefined}
                  />
                </g>
              );
            });
          })}

          <g transform={`translate(${NETWORK_NODES.START.x}, ${NETWORK_NODES.START.y})`}>
            <circle r="5" fill="#f5f5f4" stroke="#d6d3d1" strokeWidth="1" filter="url(#networkSoftShadow)" />
            <circle r="3" fill="white" stroke="#78716c" strokeWidth="0.5" />
            <circle r="1.8" fill="#06b6d4" className="animate-pulse" filter="url(#networkGlow)" />
          </g>

          {Object.values(NETWORK_NODES)
            .filter((node) => node.type === 'station')
            .map((station) => (
              <g key={station.id} transform={`translate(${station.x}, ${station.y})`}>
                <circle r="3.5" fill="white" stroke="#e5e7eb" strokeWidth="1" filter="url(#networkSoftShadow)" />
                <circle r="2.2" fill={station.color} />
                <circle
                  r="5"
                  stroke={station.color}
                  strokeWidth="0.5"
                  strokeOpacity="0.45"
                  fill="none"
                  className="animate-pulse"
                />
              </g>
            ))}

          {Object.values(NETWORK_NODES)
            .filter((node) => node.type === 'switch')
            .map((sw) => {
              const options = sw.options || [];
              const targetId = options[uiSwitches[sw.id] ?? 0];
              const target = NETWORK_NODES[targetId];
              const angle = target ? calculateAngleByIds(sw.id, target.id) : 0;

              return (
                <g
                  key={sw.id}
                  id={`switch-${sw.id}`}
                  transform={`translate(${sw.x}, ${sw.y})`}
                  className="cursor-pointer"
                  onPointerDown={() => toggleSwitch(sw.id)}
                >
                  <circle r="7" fill="transparent" />
                  <circle r="5.5" fill="url(#nodeActiveGlow)" className="animate-pulse" />
                  <circle
                    r="4"
                    fill="url(#nodeBase)"
                    stroke="#94a3b8"
                    strokeWidth="0.8"
                    className="transition-colors hover:stroke-cyan-500"
                    filter="url(#networkSoftShadow)"
                  />
                  <path
                    d="M-1.4,0 L1.4,0 L0.6,-0.8 M1.4,0 L0.6,0.8"
                    stroke="#475569"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    transform={`rotate(${angle})`}
                    className="transition-colors"
                  />
                </g>
              );
            })}

          {uiParticles.map((particle) => (
            <circle
              key={particle.id}
              cx={particle.x}
              cy={particle.y}
              r={particle.size}
              fill={particle.color}
              opacity={particle.life}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {uiPackets.map((packet) => (
            <g key={packet.id} transform={`translate(${packet.pos.x}, ${packet.pos.y}) scale(${packet.scale})`}>
              <circle r="2.5" fill={packet.color} opacity="0.3" />
              <circle r="1.5" fill={packet.color} stroke="white" strokeWidth="0.8" filter="url(#networkGlow)" />
            </g>
          ))}
        </svg>
      </Card>
    </div>
  );
};
