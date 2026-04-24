import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { Card, Button } from '@/components/ui/core';
import { clamp, avg, stdDev } from '@/lib/math';
import type { GameResult, TransitionMap } from '@/lib/types';
import { useStateMachine } from '@/lib/hooks/useFlowState';
import { useTutorial } from '@/lib/hooks/useTutorial';
import { TutorialOverlay } from '@/components/ui/TutorialOverlay';

type GameProps = {
  onComplete: (result: GameResult) => void;
  track: (event: string, payload?: Record<string, unknown>) => void;
  tutorialEnabled?: boolean;
};

type ShapeCell = 0 | 1;
type ShapeMatrix = ShapeCell[][];
type GridCell = number | null;
type GridMatrix = GridCell[][];
type MemoryPuzzlePhase = 'memorize' | 'build' | 'feedback';
type MemoryLevel = {
  level: number;
  name: string;
  gridSize: number;
  piecesCount: number;
  canRotate: boolean;
  memorizeMs: number;
  buildSec: number;
  decoys: number;
};
type PieceConfig = {
  id: number;
  shape: ShapeMatrix;
  color: string;
  initialRotation: number;
  isDecoy?: boolean;
};
type PlacedPiece = PieceConfig & {
  x: number;
  y: number;
  rotation: number;
};
type LevelOutcome = {
  success: boolean;
  timedOut: boolean;
  message: string;
};

export const GameMemory = ({ onComplete, track, tutorialEnabled = true }: GameProps) => {
  const levels = useMemo<MemoryLevel[]>(
    () => [
      { level: 1, name: 'Concepto', gridSize: 3, piecesCount: 2, canRotate: false, memorizeMs: 8000, buildSec: 0, decoys: 0 },
      { level: 2, name: 'Estructura', gridSize: 4, piecesCount: 3, canRotate: false, memorizeMs: 8000, buildSec: 50, decoys: 0 },
      { level: 3, name: 'Precision', gridSize: 4, piecesCount: 4, canRotate: true, memorizeMs: 7500, buildSec: 55, decoys: 1 },
      { level: 4, name: 'Complejidad', gridSize: 5, piecesCount: 4, canRotate: true, memorizeMs: 7000, buildSec: 60, decoys: 1 },
      { level: 5, name: 'Maestro', gridSize: 5, piecesCount: 5, canRotate: true, memorizeMs: 6500, buildSec: 65, decoys: 1 },
    ],
    []
  );

  const shapes = useMemo<ShapeMatrix[]>(
    () => [
      [[1, 1], [1, 1]],
      [[1, 1, 1, 1]],
      [[0, 1, 0], [1, 1, 1]],
      [[1, 0], [1, 0], [1, 1]],
      [[0, 1], [0, 1], [1, 1]],
      [[0, 1, 1], [1, 1, 0]],
      [[1, 1, 0], [0, 1, 1]],
      [[1, 0], [1, 1], [0, 1]],
    ],
    []
  );

  const palette = useMemo(
    () => ['#Facc15', '#F472B6', '#818CF8', '#2DD4BF', '#FB923C', '#34D399', '#A78BFA', '#FB7185'],
    []
  );

  const boardCellSize = 42;
  const boardGap = 6;
  const inventoryCellSize = 24;
  const inventoryGap = 4;
  const boardPadding = 18;

  const memoryPhaseTransitions = useMemo<TransitionMap<MemoryPuzzlePhase>>(
    () => ({
      memorize: ['build'],
      build: ['feedback'],
      feedback: ['memorize'],
    }),
    []
  );
  const [phase, transitionPhase] = useStateMachine<MemoryPuzzlePhase>(
    'memorize',
    memoryPhaseTransitions,
    'gameMemory'
  );
  const [levelIdx, setLevelIdx] = useState(0);
  const [memorizeTimeLeftMs, setMemorizeTimeLeftMs] = useState(0);
  const [buildTimeLeft, setBuildTimeLeft] = useState(0);

  const [targetGrid, setTargetGrid] = useState<GridMatrix>([]);
  const [availablePieces, setAvailablePieces] = useState<PieceConfig[]>([]);
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([]);
  const [rotationState, setRotationState] = useState<Record<number, number>>({});
  const [draggingPieceId, setDraggingPieceId] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [levelOutcome, setLevelOutcome] = useState<LevelOutcome | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const memorizeTimerRef = useRef<number | null>(null);
  const buildTimerRef = useRef<number | null>(null);
  const feedbackAdvanceTimerRef = useRef<number | null>(null);
  const feedbackFailSafeTimerRef = useRef<number | null>(null);
  const buildStartedAtRef = useRef<number>(0);
  const buildTimeoutHandledRef = useRef(false);
  const startedRef = useRef(false);
  const submittedRef = useRef(false);

  const tutorial = useTutorial([
    {
      id: 'step-memory',
      targetId: 'memory-board',
      title: 'Reconstrucción Espacial',
      description: 'Memoriza la estructura antes de que el tiempo se acabe. Haz clic en el tablero para comenzar el temporizador.',
      actionRequired: 'custom',
      animationType: 'click',
    }
  ], tutorialEnabled);

  const correctRoundsRef = useRef(0);
  const missesRef = useRef(0);
  const roundRtRef = useRef<number[]>([]);

  const currentLevel = levels[levelIdx] || levels[0];
  const boardInnerSize = currentLevel.gridSize * boardCellSize + (currentLevel.gridSize - 1) * boardGap;
  const visibleRound = levelIdx + 1;
  const visibleTotal = levels.length;
  const levelGroupLabel = `Nivel ${visibleRound} / ${visibleTotal}`;
  const inBuildMode = phase === 'build';

  const clearMemorizeTimer = useCallback(() => {
    if (memorizeTimerRef.current) {
      clearInterval(memorizeTimerRef.current);
      memorizeTimerRef.current = null;
    }
  }, []);

  const clearBuildTimer = useCallback(() => {
    if (buildTimerRef.current) {
      clearInterval(buildTimerRef.current);
      buildTimerRef.current = null;
    }
  }, []);

  const clearFeedbackAdvanceTimer = useCallback(() => {
    if (feedbackAdvanceTimerRef.current) {
      clearTimeout(feedbackAdvanceTimerRef.current);
      feedbackAdvanceTimerRef.current = null;
    }
    if (feedbackFailSafeTimerRef.current) {
      clearTimeout(feedbackFailSafeTimerRef.current);
      feedbackFailSafeTimerRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearMemorizeTimer();
    clearBuildTimer();
    clearFeedbackAdvanceTimer();
  }, [clearBuildTimer, clearFeedbackAdvanceTimer, clearMemorizeTimer]);

  const createEmptyGrid = useCallback((size: number): GridMatrix => {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
  }, []);

  const rotateShape = useCallback((shape: ShapeMatrix): ShapeMatrix => {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated: ShapeMatrix = Array.from({ length: cols }, () =>
      Array.from({ length: rows }, () => 0 as ShapeCell)
    );

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        rotated[c][rows - 1 - r] = shape[r][c];
      }
    }

    return rotated;
  }, []);

  const getRotatedShape = useCallback(
    (shape: ShapeMatrix, turns: number) => {
      let next = shape;
      for (let i = 0; i < turns; i += 1) next = rotateShape(next);
      return next;
    },
    [rotateShape]
  );

  const canPlacePiece = useCallback((grid: GridMatrix, shape: ShapeMatrix, gridX: number, gridY: number) => {
    const gridSize = grid.length;

    for (let r = 0; r < shape.length; r += 1) {
      for (let c = 0; c < shape[r].length; c += 1) {
        if (!shape[r][c]) continue;
        const x = gridX + c;
        const y = gridY + r;
        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
        if (grid[y][x] !== null) return false;
      }
    }
    return true;
  }, []);

  const placePieceOnGrid = useCallback(
    (grid: GridMatrix, shape: ShapeMatrix, gridX: number, gridY: number, pieceId: number) => {
      const next = grid.map((row) => [...row]);
      for (let r = 0; r < shape.length; r += 1) {
        for (let c = 0; c < shape[r].length; c += 1) {
          if (!shape[r][c]) continue;
          next[gridY + r][gridX + c] = pieceId;
        }
      }
      return next;
    },
    []
  );

  const generatePuzzle = useCallback(
    (gridSize: number, pieceCount: number, decoysCount: number, allowRotation: boolean) => {
      let grid = createEmptyGrid(gridSize);
      const pieces: PieceConfig[] = [];
      let attempts = 0;

      while (pieces.length < pieceCount && attempts < 1200) {
        attempts += 1;
        const shapeBase = shapes[Math.floor(Math.random() * shapes.length)];
        const solutionRotation = allowRotation ? Math.floor(Math.random() * 4) : 0;
        const solutionShape = getRotatedShape(shapeBase, solutionRotation);

        for (let t = 0; t < 70; t += 1) {
          const gx = Math.floor(Math.random() * gridSize);
          const gy = Math.floor(Math.random() * gridSize);
          if (!canPlacePiece(grid, solutionShape, gx, gy)) continue;

          const id = pieces.length;
          pieces.push({
            id,
            shape: shapeBase,
            color: palette[id % palette.length],
            initialRotation: 0,
            isDecoy: false,
          });
          grid = placePieceOnGrid(grid, solutionShape, gx, gy, id);
          break;
        }
      }

      for (let i = 0; i < decoysCount; i += 1) {
        pieces.push({
          id: 900 + i,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          color: palette[(pieces.length + 2) % palette.length],
          initialRotation: 0,
          isDecoy: true,
        });
      }

      return { targetGrid: grid, pieces: [...pieces].sort(() => Math.random() - 0.5) };
    },
    [canPlacePiece, createEmptyGrid, getRotatedShape, palette, placePieceOnGrid, shapes]
  );

  const finalizeGame = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    clearAllTimers();

    const accuracy = correctRoundsRef.current / levels.length;
    const avgRt = Math.round(avg(roundRtRef.current));
    const consistencyIndex = clamp(Math.round(100 - stdDev(roundRtRef.current) / 25), 0, 100);
    const speedBonus = avgRt > 0 ? clamp(Math.round((52000 - avgRt) / 4500), 0, 8) : 0;
    let score = clamp(
      Math.round(
        accuracy * 74 +
          clamp((consistencyIndex - 55) * 0.12, -6, 6) +
          speedBonus -
          missesRef.current * 6
      ),
      0,
      100
    );

    if (correctRoundsRef.current <= 1) score = Math.min(score, 16);
    else if (correctRoundsRef.current === 2) score = Math.min(score, 34);
    else if (correctRoundsRef.current === 3) score = Math.min(score, 56);
    else if (correctRoundsRef.current === 4) score = Math.min(score, 82);

    track('game_submitted', {
      score,
      correctRounds: correctRoundsRef.current,
      misses: missesRef.current,
      avgRt,
    });

    onComplete({
      score,
      metrics: {
        correct_rounds: correctRoundsRef.current,
        total_rounds: levels.length,
        misses: missesRef.current,
        accuracy: Number(accuracy.toFixed(2)),
        avg_rt_ms: avgRt,
        consistency_index: consistencyIndex,
      },
    });
  }, [clearAllTimers, levels.length, onComplete, track]);

  const startLevel = useCallback(
    (nextLevelIdx: number) => {
      clearAllTimers();
      const safeLevelIdx = clamp(nextLevelIdx, 0, levels.length - 1);
      const cfg = levels[safeLevelIdx];
      const { targetGrid: nextTarget, pieces } = generatePuzzle(cfg.gridSize, cfg.piecesCount, cfg.decoys, cfg.canRotate);

      const initialRotations: Record<number, number> = {};
      for (const piece of pieces) initialRotations[piece.id] = piece.initialRotation;

      setLevelIdx(safeLevelIdx);
      setTargetGrid(nextTarget);
      setAvailablePieces(pieces);
      setPlacedPieces([]);
      setRotationState(initialRotations);
      setDraggingPieceId(null);
      setGhostPosition(null);
      setMemorizeTimeLeftMs(cfg.memorizeMs);
      setBuildTimeLeft(cfg.buildSec);
      setLevelOutcome(null);
      transitionPhase('memorize', { force: true });
      buildStartedAtRef.current = 0;
      buildTimeoutHandledRef.current = false;

      track('round_started', {
        round: safeLevelIdx + 1,
        gridSize: cfg.gridSize,
        pieces: cfg.piecesCount,
        decoys: cfg.decoys,
      });
    },
    [clearAllTimers, generatePuzzle, levels, track, transitionPhase]
  );

  const startLevelRef = useRef(startLevel);
  useEffect(() => {
    startLevelRef.current = startLevel;
  }, [startLevel]);

  const finalizeGameRef = useRef(finalizeGame);
  useEffect(() => {
    finalizeGameRef.current = finalizeGame;
  }, [finalizeGame]);

  const advanceAfterFeedback = useCallback(() => {
    clearFeedbackAdvanceTimer();
    const nextLevel = levelIdx + 1;
    if (nextLevel >= levels.length) {
      finalizeGameRef.current();
      return;
    }
    startLevelRef.current(nextLevel);
  }, [clearFeedbackAdvanceTimer, levelIdx, levels.length]);

  const buildOccupancyGrid = useCallback(
    (excludePieceId: number | null = null) => {
      const occupancy = createEmptyGrid(currentLevel.gridSize);

      for (const placed of placedPieces) {
        if (excludePieceId !== null && placed.id === excludePieceId) continue;
        const shape = getRotatedShape(placed.shape, placed.rotation);
        for (let r = 0; r < shape.length; r += 1) {
          for (let c = 0; c < shape[r].length; c += 1) {
            if (!shape[r][c]) continue;
            const x = placed.x + c;
            const y = placed.y + r;
            if (x < 0 || x >= currentLevel.gridSize || y < 0 || y >= currentLevel.gridSize) continue;
            occupancy[y][x] = placed.id;
          }
        }
      }
      return occupancy;
    },
    [createEmptyGrid, currentLevel.gridSize, getRotatedShape, placedPieces]
  );

  const calculateGridPosition = useCallback(
    (clientX: number, clientY: number, shape: ShapeMatrix) => {
      if (!boardRef.current) return null;
      const rect = boardRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left - boardPadding;
      const relativeY = clientY - rect.top - boardPadding;

      const shapeWidth = shape[0].length * (boardCellSize + boardGap) - boardGap;
      const shapeHeight = shape.length * (boardCellSize + boardGap) - boardGap;

      const x = Math.round((relativeX - shapeWidth / 2) / (boardCellSize + boardGap));
      const y = Math.round((relativeY - shapeHeight / 2) / (boardCellSize + boardGap));
      return { x, y };
    },
    [boardCellSize, boardGap]
  );

  const validateCurrentLevel = useCallback(
    (timedOut = false) => {
      if (phase !== 'build') return;
      clearBuildTimer();

      const occupancy = createEmptyGrid(currentLevel.gridSize);
      let hasCollisionOrOut = false;
      let decoyUsed = false;

      for (const placed of placedPieces) {
        if (placed.isDecoy || placed.id >= 900) decoyUsed = true;
        const shape = getRotatedShape(placed.shape, placed.rotation);
        for (let r = 0; r < shape.length; r += 1) {
          for (let c = 0; c < shape[r].length; c += 1) {
            if (!shape[r][c]) continue;
            const x = placed.x + c;
            const y = placed.y + r;
            if (x < 0 || x >= currentLevel.gridSize || y < 0 || y >= currentLevel.gridSize) {
              hasCollisionOrOut = true;
              continue;
            }
            if (occupancy[y][x] !== null) hasCollisionOrOut = true;
            occupancy[y][x] = placed.id;
          }
        }
      }

      let occupancyMatches = !hasCollisionOrOut;
      for (let r = 0; r < currentLevel.gridSize; r += 1) {
        for (let c = 0; c < currentLevel.gridSize; c += 1) {
          const targetCell = targetGrid[r]?.[c] !== null ? 1 : 0;
          const currentCell = occupancy[r]?.[c] !== null ? 1 : 0;
          if (targetCell !== currentCell) occupancyMatches = false;
        }
      }

      const success = occupancyMatches && !decoyUsed;
      const rtMs = Math.max(0, Date.now() - buildStartedAtRef.current);
      roundRtRef.current.push(rtMs);

      if (success) {
        correctRoundsRef.current += 1;
        track('decision_made', { type: 'memory_blueprint_match', round: levelIdx + 1, rtMs });
      } else {
        missesRef.current += 1;
        track('error_committed', {
          type: timedOut ? 'memory_blueprint_timeout' : 'memory_blueprint_mismatch',
          round: levelIdx + 1,
          rtMs,
          decoyUsed,
        });
      }

      setLevelOutcome({
        success,
        timedOut,
        message: success
          ? 'La estructura coincide con el diseño.'
          : timedOut
            ? 'Se agoto el tiempo del nivel.'
            : 'La estructura no coincide con el diseño.',
      });
      setDraggingPieceId(null);
      setGhostPosition(null);
      transitionPhase('feedback');
    },
    [clearBuildTimer, createEmptyGrid, currentLevel.gridSize, getRotatedShape, levelIdx, phase, placedPieces, targetGrid, track, transitionPhase]
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startLevel(0);
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers, startLevel]);

  useEffect(() => {
    if (phase !== 'memorize' || tutorial.isActive) return;
    clearMemorizeTimer();

    const startedAt = Date.now();
    const initial = currentLevel.memorizeMs;
    setMemorizeTimeLeftMs(initial);

    memorizeTimerRef.current = window.setInterval(() => {
      const remaining = Math.max(0, initial - (Date.now() - startedAt));
      setMemorizeTimeLeftMs(remaining);

      if (remaining <= 0) {
        clearMemorizeTimer();
        transitionPhase('build');
        buildStartedAtRef.current = Date.now();
        buildTimeoutHandledRef.current = false;
        setBuildTimeLeft(currentLevel.buildSec);
      }
    }, 50);

    return clearMemorizeTimer;
  }, [clearMemorizeTimer, currentLevel.buildSec, currentLevel.memorizeMs, phase, transitionPhase, tutorial.isActive]);

  useEffect(() => {
    if (phase !== 'build') return;
    clearBuildTimer();
    if (currentLevel.buildSec <= 0) return;

    setBuildTimeLeft(currentLevel.buildSec);
    buildTimerRef.current = window.setInterval(() => {
      setBuildTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return clearBuildTimer;
  }, [clearBuildTimer, currentLevel.buildSec, phase]);

  useEffect(() => {
    if (phase !== 'build') return;
    if (currentLevel.buildSec <= 0) return;
    if (buildTimeLeft > 0) return;
    if (buildTimeoutHandledRef.current) return;
    buildTimeoutHandledRef.current = true;
    validateCurrentLevel(true);
  }, [buildTimeLeft, currentLevel.buildSec, phase, validateCurrentLevel]);

  useEffect(() => {
    if (phase !== 'feedback' || !levelOutcome) return;
    clearFeedbackAdvanceTimer();
    feedbackAdvanceTimerRef.current = window.setTimeout(() => {
      advanceAfterFeedback();
    }, 1050);
    feedbackFailSafeTimerRef.current = window.setTimeout(() => {
      advanceAfterFeedback();
    }, 2400);
    return clearFeedbackAdvanceTimer;
  }, [advanceAfterFeedback, clearFeedbackAdvanceTimer, levelOutcome, phase]);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>, pieceId: number, fromBoard: boolean) => {
    if (!inBuildMode) return;
    if (fromBoard) {
      setPlacedPieces((prev) => prev.filter((piece) => piece.id !== pieceId));
    }
    setDraggingPieceId(pieceId);
    setDragPosition({ x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPieceId === null || !inBuildMode) return;
    setDragPosition({ x: event.clientX, y: event.clientY });

    const piece = availablePieces.find((item) => item.id === draggingPieceId);
    if (!piece) return;

    const rotation = rotationState[piece.id] || 0;
    const shape = getRotatedShape(piece.shape, rotation);
    const position = calculateGridPosition(event.clientX, event.clientY, shape);
    if (!position) {
      setGhostPosition(null);
      return;
    }

    const occupancy = buildOccupancyGrid(draggingPieceId);
    if (canPlacePiece(occupancy, shape, position.x, position.y)) {
      setGhostPosition(position);
      return;
    }
    setGhostPosition(null);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPieceId === null || !inBuildMode) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    const piece = availablePieces.find((item) => item.id === draggingPieceId);
    if (piece && ghostPosition) {
      const rotation = rotationState[piece.id] || 0;
      setPlacedPieces((prev) => [...prev, { ...piece, x: ghostPosition.x, y: ghostPosition.y, rotation }]);
      track('decision_made', {
        type: 'memory_piece_placed',
        round: levelIdx + 1,
        pieceId: piece.id,
        x: ghostPosition.x,
        y: ghostPosition.y,
        decoy: Boolean(piece.isDecoy),
      });
    }

    setDraggingPieceId(null);
    setGhostPosition(null);
  };

  const handleRotatePiece = (event: React.MouseEvent<HTMLButtonElement>, pieceId: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (!inBuildMode || !currentLevel.canRotate) return;

    setRotationState((prev) => {
      const next = ((prev[pieceId] || 0) + 1) % 4;
      return { ...prev, [pieceId]: next };
    });
    track('decision_made', { type: 'memory_piece_rotated', round: levelIdx + 1, pieceId });
  };

  const handleUndoLastPlacement = useCallback(() => {
    if (!inBuildMode) return;
    setPlacedPieces((prev) => {
      if (!prev.length) return prev;
      const removed = prev[prev.length - 1];
      track('decision_changed', {
        type: 'memory_undo_piece',
        round: levelIdx + 1,
        pieceId: removed.id,
      });
      return prev.slice(0, -1);
    });
    setGhostPosition(null);
  }, [inBuildMode, levelIdx, track]);

  const handleClearBoard = useCallback(() => {
    if (!inBuildMode || !placedPieces.length) return;
    const removedCount = placedPieces.length;
    setPlacedPieces([]);
    setGhostPosition(null);
    setDraggingPieceId(null);
    track('decision_changed', {
      type: 'memory_clear_board',
      round: levelIdx + 1,
      removedCount,
    });
  }, [inBuildMode, levelIdx, placedPieces.length, track]);

  const renderShape = (
    shape: ShapeMatrix,
    color: string,
    rotation: number,
    cellSize: number,
    ghost = false,
    gap = boardGap
  ) => {
    const rotated = getRotatedShape(shape, rotation);
    const rows = rotated.length;
    const cols = rotated[0].length;
    const width = cols * cellSize + (cols - 1) * gap;
    const height = rows * cellSize + (rows - 1) * gap;

    return (
      <div className="relative" style={{ width, height }}>
        {rotated.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            return (
              <div
                key={`${r}-${c}`}
                className={`absolute rounded-md ${ghost ? 'border-2 border-dashed border-cyan-300 bg-cyan-100/40' : 'shadow-sm'}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  left: c * (cellSize + gap),
                  top: r * (cellSize + gap),
                  backgroundColor: ghost ? undefined : color,
                  boxShadow: ghost
                    ? undefined
                    : 'inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 0 rgba(0,0,0,0.12)',
                }}
              />
            );
          })
        )}
      </div>
    );
  };

  const pieceColorById = useMemo(() => {
    const byId = new Map<number, string>();
    for (const piece of availablePieces) byId.set(piece.id, piece.color);
    return byId;
  }, [availablePieces]);

  const inventoryPieces = availablePieces.filter((piece) => !placedPieces.some((placed) => placed.id === piece.id));

  return (
    <div
      className="w-full max-w-6xl mx-auto pt-8 px-4 animate-fade-in touch-none select-none relative z-0"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      <TutorialOverlay
        isActive={tutorial.isActive}
        targetRect={tutorial.targetRect}
        step={tutorial.currentStep}
      />
      <div className="text-center mb-6">
        <div className="text-xs font-bold uppercase tracking-wide text-cyan-600 mb-1">{levelGroupLabel}</div>
        <h3 className="text-lg text-cyan-600 font-bold uppercase tracking-widest">
          Ronda {visibleRound} / {visibleTotal}
        </h3>
        <p className="text-stone-600 text-sm mt-2">
          {phase === 'memorize'
            ? `Memoriza la estructura · ${Math.max(0, Math.ceil(memorizeTimeLeftMs / 1000))}s`
            : currentLevel.buildSec > 0
              ? `Reconstruye la estructura · ${buildTimeLeft}s`
              : 'Reconstruye la estructura sin límite de tiempo'}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
        <Card className="p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-stone-400">Diseño</div>
              <div className="text-lg font-bold text-stone-700">{currentLevel.name}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider font-bold text-stone-400">Fase</div>
              <div className="text-base font-semibold text-cyan-700">{phase === 'memorize' ? 'Memorizar' : 'Construir'}</div>
            </div>
          </div>

          <div
            id="memory-board"
            ref={boardRef}
            data-testid="memory-board"
            onClick={() => {
              if (tutorial.isActive) tutorial.advanceStep();
            }}
            className={`relative mx-auto rounded-2xl border border-stone-200 bg-stone-50 p-[18px] ${tutorial.isActive ? 'cursor-pointer' : ''}`}
            style={{ width: boardInnerSize + boardPadding * 2 }}
          >
            <div className="relative" style={{ width: boardInnerSize, height: boardInnerSize }}>
              {Array.from({ length: currentLevel.gridSize }).map((_, row) =>
                Array.from({ length: currentLevel.gridSize }).map((__, col) => (
                  <div
                    key={`slot-${row}-${col}`}
                    className="absolute rounded-md border border-stone-200/70 bg-stone-100"
                    style={{
                      width: boardCellSize,
                      height: boardCellSize,
                      left: col * (boardCellSize + boardGap),
                      top: row * (boardCellSize + boardGap),
                    }}
                  />
                ))
              )}

              {phase === 'memorize'
                ? targetGrid.map((row, r) =>
                    row.map((cell, c) => {
                      if (cell === null) return null;
                      const color = pieceColorById.get(cell) || '#14b8a6';
                      return (
                        <div
                          key={`target-${r}-${c}`}
                          className="absolute rounded-md shadow-sm"
                          style={{
                            width: boardCellSize,
                            height: boardCellSize,
                            left: c * (boardCellSize + boardGap),
                            top: r * (boardCellSize + boardGap),
                            backgroundColor: color,
                          }}
                        />
                      );
                    })
                  )
                : null}

              {phase === 'build' && ghostPosition && draggingPieceId !== null
                ? (() => {
                    const ghostPiece = availablePieces.find((piece) => piece.id === draggingPieceId);
                    if (!ghostPiece) return null;
                    return (
                      <div
                        className="absolute pointer-events-none z-0"
                        style={{
                          left: ghostPosition.x * (boardCellSize + boardGap),
                          top: ghostPosition.y * (boardCellSize + boardGap),
                        }}
                      >
                        {renderShape(
                          ghostPiece.shape,
                          ghostPiece.color,
                          rotationState[ghostPiece.id] || 0,
                          boardCellSize,
                          true
                        )}
                      </div>
                    );
                  })()
                : null}

              {phase !== 'memorize'
                ? placedPieces.map((placed) => (
                    <div
                      key={`placed-${placed.id}`}
                      className={`absolute z-10 ${phase === 'build' ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                      style={{
                        left: placed.x * (boardCellSize + boardGap),
                        top: placed.y * (boardCellSize + boardGap),
                      }}
                      onPointerDown={(event) => handlePointerDown(event, placed.id, true)}
                    >
                      {renderShape(placed.shape, placed.color, rotationState[placed.id] || 0, boardCellSize, false)}
                      {currentLevel.canRotate && phase === 'build' ? (
                        <button
                          className="absolute -top-2 -right-2 bg-white border border-stone-200 rounded-full p-1.5 text-stone-600 hover:text-cyan-700"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => handleRotatePiece(event, placed.id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))
                : null}

              {phase === 'feedback' && levelOutcome ? (
                <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                  <div
                    className={`px-6 py-4 rounded-2xl border shadow-lg flex items-center gap-3 animate-[memoryBadge_220ms_ease-out] ${
                      levelOutcome.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {levelOutcome.success ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                    <div>
                      <div className="text-lg font-bold">{levelOutcome.success ? 'Correcto!' : 'Incorrecto'}</div>
                      <div className="text-xs opacity-80">{levelOutcome.message}</div>
                    </div>
                    <button
                      type="button"
                      onClick={advanceAfterFeedback}
                      className="ml-3 rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white transition-colors"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              ) : null}
             </div>
          </div>
        </Card>

        <Card className={`p-4 space-y-4 ${phase !== 'build' ? 'opacity-60 pointer-events-none' : ''}`}>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-1">Inventario</div>
            <div className="text-sm text-stone-600">Arrastra y rota piezas para reconstruir la forma exacta.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-2 max-h-[360px] overflow-y-auto pr-1">
            {inventoryPieces.length ? (
              inventoryPieces.map((piece) => (
                <div
                  key={`inventory-${piece.id}`}
                  data-testid={`memory-piece-${piece.id}`}
                  className="relative min-h-[108px] rounded-lg border border-stone-200 bg-stone-50 p-2 cursor-grab active:cursor-grabbing hover:bg-white flex items-center justify-center overflow-visible"
                  onPointerDown={(event) => handlePointerDown(event, piece.id, false)}
                >
                  {renderShape(piece.shape, piece.color, rotationState[piece.id] || 0, inventoryCellSize, false, inventoryGap)}
                  {currentLevel.canRotate ? (
                    <button
                      className="absolute top-1 right-1 bg-white border border-stone-200 rounded-full p-1 text-stone-500 hover:text-cyan-700"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => handleRotatePiece(event, piece.id)}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="sm:col-span-2 text-center text-sm text-stone-400 py-8">Todas las piezas fueron utilizadas.</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="w-full px-3 py-2 text-xs sm:text-sm"
              onClick={handleUndoLastPlacement}
              disabled={!placedPieces.length}
            >
              Deshacer última
            </Button>
            <Button
              variant="secondary"
              className="w-full px-3 py-2 text-xs sm:text-sm"
              onClick={handleClearBoard}
              disabled={!placedPieces.length}
            >
              Limpiar tablero
            </Button>
          </div>

          <Button onClick={() => validateCurrentLevel(false)} className="w-full">
            <span data-testid="memory-verify" className="contents">
              Verificar estructura
            </span>
          </Button>
        </Card>
      </div>

      {draggingPieceId !== null
        ? (() => {
            const piece = availablePieces.find((item) => item.id === draggingPieceId);
            if (!piece) return null;
            return (
              <div
                className="fixed pointer-events-none z-[100]"
                style={{
                  left: dragPosition.x,
                  top: dragPosition.y,
                  transform: 'translate(-50%, -50%) rotate(4deg) scale(1.03)',
                  filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.22))',
                }}
              >
                {renderShape(piece.shape, piece.color, rotationState[piece.id] || 0, boardCellSize)}
              </div>
            );
          })()
        : null}

      <style jsx>{`
        @keyframes memoryBadge {
          0% {
            transform: scale(0.92) translateY(6px);
            opacity: 0;
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
