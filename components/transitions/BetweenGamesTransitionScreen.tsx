import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2 } from 'lucide-react';

export const BETWEEN_GAME_LINES = [
  'Perfecto, avancemos al siguiente juego.',
  'Reto completado. Avanzando a la siguiente evaluación.',
  'Muy bien. Continuemos con el siguiente reto.',
  'Buen ritmo. Vamos con la siguiente simulación.',
  'Excelente avance. Entramos al próximo desafío.',
  'Último tramo: una evaluación más y cerramos.',
];

const BETWEEN_GAME_AUDIO = [
  { src: '/audio/transitions/1.mp3', durationMs: 2769 },
  { src: '/audio/transitions/2.mp3', durationMs: 3474 },
  { src: '/audio/transitions/3.mp3', durationMs: 2769 },
  { src: '/audio/transitions/4.mp3', durationMs: 2691 },
  { src: '/audio/transitions/5.mp3', durationMs: 3239 },
  { src: '/audio/transitions/6.mp3', durationMs: 3239 },
] as const;

export const BetweenGamesTransitionScreen = ({
  fromTitle,
  toTitle,
  line,
  lineIndex,
  onComplete,
}: {
  fromTitle: string;
  toTitle: string;
  line: string;
  lineIndex: number;
  onComplete: () => void;
}) => {
  const [canSkip, setCanSkip] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioMeta = BETWEEN_GAME_AUDIO[lineIndex % BETWEEN_GAME_AUDIO.length];
  const transitionDurationMs = Math.max(audioMeta.durationMs + 1800, 4300);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, transitionDurationMs);
    return () => clearTimeout(timer);
  }, [onComplete, transitionDurationMs]);

  useEffect(() => {
    const unlockTimer = window.setTimeout(() => setCanSkip(true), 1800);
    return () => clearTimeout(unlockTimer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canSkip) return;
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        onComplete();
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canSkip, onComplete]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    const playPromise = audioRef.current.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => setAudioBlocked(true));
    }
  }, [lineIndex]);

  useEffect(() => {
    return () => {
      if (!audioRef.current) return;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    };
  }, []);

  const handleEnableAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    void audioRef.current.play().then(() => setAudioBlocked(false));
  }, []);

  return (
    <div className="min-h-[calc(100vh-96px)] flex flex-col items-center justify-center px-6 py-8 text-center animate-fade-in relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-stone-100 to-stone-200/50 z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-200/30 via-transparent to-transparent z-0" />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay z-0 pointer-events-none" />

      <audio ref={audioRef} src={audioMeta.src} preload="auto" className="hidden" />

      <div className="w-full max-w-[21rem] sm:max-w-[30rem] md:max-w-[38rem] lg:max-w-[46rem] flex flex-col items-center justify-center gap-7 relative z-10 bg-white/40 backdrop-blur-xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-[2rem] p-8 md:p-12 overflow-hidden group">
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-cyan-400/10 to-sky-300/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000"></div>

        <div className="relative z-10 w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 shadow-inner flex items-center justify-center animate-pulse">
          <div className="relative w-7 h-7" aria-hidden>
            <span className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-cyan-600/90" />
            <span className="absolute top-1/2 left-0 w-full h-[3px] -translate-y-1/2 rounded-full bg-cyan-600/90" />
            <span className="absolute left-1/2 top-1/2 w-[2px] h-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300" />
          </div>
        </div>

        <div className="relative z-10 space-y-1">
          <h2 className="text-[1.9rem] sm:text-[2.15rem] md:text-[2.45rem] lg:text-[2.7rem] font-black text-transparent bg-clip-text bg-gradient-to-br from-stone-800 to-stone-600 leading-[1.18] tracking-[-0.01em]">
            {line}
          </h2>
        </div>

        <div className="relative z-10 w-full max-w-xl bg-white/60 backdrop-blur-sm border border-white/50 rounded-xl px-4 py-3 text-sm text-stone-600 shadow-sm flex items-center justify-center">
          <span className="font-semibold text-stone-700">{fromTitle}</span>
          <span className="mx-3 text-stone-300 text-lg leading-none">{'>'}</span>
          <span className="font-bold text-cyan-700">{toTitle}</span>
        </div>

        <div className="relative z-10 w-full h-1.5 bg-stone-300/40 rounded-full overflow-hidden mt-2 max-w-sm mx-auto">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-sky-600 absolute left-0 top-0 shadow-[0_0_10px_rgba(34,211,238,0.4)]"
            style={{
              width: '100%',
              animation: `betweenGamesFill ${transitionDurationMs}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
            }}
          />
        </div>

        {audioBlocked ? (
          <button
            type="button"
            onClick={handleEnableAudio}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300 hover:bg-cyan-50"
          >
            <Volume2 className="h-4 w-4" />
            Activar audio
          </button>
        ) : null}

        <button
          onClick={onComplete}
          disabled={!canSkip}
          className={`text-xs font-semibold tracking-wide transition-colors ${
            canSkip ? 'text-cyan-700 hover:text-cyan-800' : 'text-stone-400 cursor-not-allowed'
          }`}
        >
          {canSkip ? 'Continuar ahora' : 'Preparando siguiente juego...'}
        </button>
      </div>

      <style jsx>{`
        @keyframes betweenGamesFill {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
