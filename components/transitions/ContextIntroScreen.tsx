import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Volume2 } from 'lucide-react';

export const ContextIntroScreen = ({ onComplete }: { onComplete: () => void }) => {
  const slides = useMemo(
    () => [
      {
        text:
          'Bienvenido a Initium+. Transformamos el análisis de datos y tendencias en una comprensión profunda de cada candidato.',
        cueStartSec: 0,
        cueEndSec: 7.9,
      },
      {
        text:
          'Nuestra tecnología en tiempo real permite descifrar el potencial humano para conectar el mejor talento con las mejores oportunidades.',
        cueStartSec: 7.9,
        cueEndSec: 16.89,
      },
      {
        text:
          'A continuación, te enfrentarás a una serie de desafíos: desde preguntas para conocerte mejor hasta dinámicas de juego que nos permitirán identificar tu potencial.',
        cueStartSec: 16.89,
        cueEndSec: 27.83,
      },
      {
        text: 'Relájate y disfruta la experiencia.',
        cueStartSec: 27.83,
        cueEndSec: 30.2,
      },
    ].map((slide) => ({
      ...slide,
      durationMs: Math.round((slide.cueEndSec - slide.cueStartSec) * 1000),
    })),
    []
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const current = slides[currentIndex];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, forceRender] = useState({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeUpdateHandlerRef = useRef<(() => void) | null>(null);
  const autoplayAttemptedRef = useRef(false);

  const clearSegmentListener = useCallback(() => {
    if (!audioRef.current || !timeUpdateHandlerRef.current) return;
    audioRef.current.removeEventListener('timeupdate', timeUpdateHandlerRef.current);
    timeUpdateHandlerRef.current = null;
  }, []);

  const playSlideAudio = useCallback(
    async (slideIndex: number, allowBlockedState = true) => {
      const audio = audioRef.current;
      const slide = slides[slideIndex];
      if (!audio || !slide) return false;

      clearSegmentListener();
      audio.pause();
      audio.currentTime = slide.cueStartSec;

      const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        if (audioRef.current.currentTime >= slide.cueEndSec) {
          audioRef.current.pause();
          clearSegmentListener();
        }
      };

      timeUpdateHandlerRef.current = handleTimeUpdate;
      audio.addEventListener('timeupdate', handleTimeUpdate);

      try {
        await audio.play();
        setAudioBlocked(false);
        return true;
      } catch {
        clearSegmentListener();
        if (allowBlockedState) setAudioBlocked(true);
        return false;
      }
    },
    [clearSegmentListener, slides]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (currentIndex < slides.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onComplete();
      }
    }, current.durationMs);
    return () => clearTimeout(timer);
  }, [currentIndex, current.durationMs, onComplete, slides.length]);

  useEffect(() => {
    if (currentIndex === 0 && !autoplayAttemptedRef.current) {
      autoplayAttemptedRef.current = true;
      void playSlideAudio(currentIndex);
      return;
    }

    if (!audioBlocked) {
      void playSlideAudio(currentIndex, false);
    }
  }, [audioBlocked, currentIndex, playSlideAudio]);

  useEffect(() => {
    return () => {
      clearSegmentListener();
      if (!audioRef.current) return;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    };
  }, [clearSegmentListener]);

  const handleEnableAudio = useCallback(() => {
    void playSlideAudio(currentIndex);
  }, [currentIndex, playSlideAudio]);

  return (
    <div className="min-h-[calc(100vh-96px)] flex flex-col items-center justify-center px-6 py-8 text-center animate-fade-in relative bg-stone-50">
      <audio ref={audioRef} src="/audio/initium-intro.mp3" preload="auto" className="hidden" />
      <div className="w-full max-w-[21rem] sm:max-w-[30rem] md:max-w-[38rem] lg:max-w-[46rem] flex flex-col items-center justify-center gap-8">
        <div className="w-16 h-16 rounded-full bg-cyan-50 border border-cyan-100 shadow-inner flex items-center justify-center animate-pulse">
          <div className="relative w-6 h-6" aria-hidden>
            <span className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-cyan-500/90" />
            <span className="absolute top-1/2 left-0 w-full h-[3px] -translate-y-1/2 rounded-full bg-cyan-500/90" />
            <span className="absolute left-1/2 top-1/2 w-[2px] h-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300" />
          </div>
        </div>

        <h2
          key={`text-${currentIndex}`}
          className="text-[1.95rem] sm:text-[2.2rem] md:text-[2.55rem] lg:text-[2.85rem] font-light text-stone-800 leading-[1.17] tracking-[-0.01em] animate-fade-in"
        >
          {current.text}
        </h2>

        <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mt-7 max-w-sm mx-auto relative">
          <div
            key={`bar-${currentIndex}`}
            className="h-full bg-cyan-500 absolute left-0 top-0"
            style={{
              width: '100%',
              animation: `introFill ${current.durationMs}ms linear forwards`,
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
            Activar narración
          </button>
        ) : null}
      </div>

      <style jsx>{`
        @keyframes introFill {
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
