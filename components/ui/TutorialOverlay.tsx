import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MousePointer2, Hand } from 'lucide-react';
import type { TutorialStep } from '@/lib/hooks/useTutorial';

type TutorialOverlayProps = {
  isActive: boolean;
  targetRect: DOMRect | null;
  step: TutorialStep | null;
  onAdvance?: () => void;
};

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isActive,
  targetRect,
  step,
  onAdvance,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isActive || !step) return null;

  const hasTarget = !!targetRect;

  // Padding around the target
  const pad = 12;
  const x = hasTarget ? targetRect.x - pad : 0;
  const y = hasTarget ? targetRect.y - pad : 0;
  const w = hasTarget ? targetRect.width + pad * 2 : 0;
  const h = hasTarget ? targetRect.height + pad * 2 : 0;

  const centerX = hasTarget ? targetRect.x + targetRect.width / 2 : window.innerWidth / 2;
  const centerY = hasTarget ? targetRect.y + targetRect.height / 2 : window.innerHeight / 2;

  // Let's cap tooltipY so it doesn't push the tooltip below the screen if the hole is big.
  let tooltipY = hasTarget ? targetRect.y + targetRect.height + 24 : window.innerHeight / 2;
  if (hasTarget && tooltipY > window.innerHeight - 100) {
    // If it's too close to bottom, position it INSIDE or slightly above the target.
    tooltipY = targetRect.y + targetRect.height / 2;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none" data-testid="tutorial-overlay">
      {/* Darkened backdrop with a mask to cut out the target rect */}
      {hasTarget ? (
        <>
          {/* Invisible click blockers to prevent clicking outside the hole */}
          <div className="absolute top-0 inset-x-0 pointer-events-auto" style={{ height: y }} />
          <div className="absolute inset-x-0 pointer-events-auto" style={{ top: y + h, bottom: 0 }} />
          <div className="absolute pointer-events-auto" style={{ top: y, height: h, left: 0, width: x }} />
          <div className="absolute pointer-events-auto" style={{ top: y, height: h, left: x + w, right: 0 }} />

          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <defs>
              <mask id="hole">
                <rect width="100%" height="100%" fill="white" />
                <rect x={x} y={y} width={w} height={h} rx={16} fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(28, 25, 23, 0.75)" mask="url(#hole)" className="backdrop-blur-[2px]" />
          </svg>
        </>
      ) : (
        <div className="absolute inset-0 bg-stone-900/75 backdrop-blur-[2px] pointer-events-auto transition-all duration-400" />
      )}

      {/* Pulsing ring around the target */}
      {hasTarget && (
        <div
          className="absolute border-2 border-cyan-400 rounded-2xl animate-pulse pointer-events-none"
          style={{ left: x, top: y, width: w, height: h, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      )}

      {/* Micro-animation (Placed over the hole) */}
      {hasTarget && step.animationType === 'click' && (
        <div
          className="absolute pointer-events-none"
          style={{ left: centerX, top: centerY, transform: 'translate(-50%, -50%)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute w-8 h-8 bg-cyan-400/30 rounded-full animate-ping" />
            <MousePointer2 className="w-10 h-10 text-cyan-500 absolute -bottom-2 -right-2 animate-bounce drop-shadow-md" fill="currentColor" />
          </div>
        </div>
      )}

      {hasTarget && step.animationType === 'drag' && (
        <div
          className="absolute pointer-events-none"
          style={{ left: centerX, top: centerY, transform: 'translate(-50%, -50%)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <div className="relative w-24 h-16 flex items-center justify-center">
            <Hand className="w-10 h-10 text-white stroke-stone-800 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] tutorial-drag-animation" fill="white" strokeWidth="1.5" />
          </div>
        </div>
      )}

      {/* Tooltip text */}
      <div
        className="absolute flex flex-col items-center pointer-events-none"
        style={{ left: centerX, top: tooltipY, transform: 'translateX(-50%)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', width: 'max-content', maxWidth: '320px' }}
      >
        <div className="bg-white/90 backdrop-blur-xl border border-stone-200/50 shadow-2xl p-4 rounded-2xl flex flex-col items-center text-center gap-2 mb-4">
          <span className="text-stone-800 font-bold text-lg">{step.title}</span>
          {step.description && <span className="text-stone-500 text-sm leading-tight">{step.description}</span>}
        </div>
      </div>

      <style jsx>{`
        @keyframes tutorialDrag {
          0% {
            transform: translate(-30px, 0) scale(1);
          }
          20% {
            transform: translate(-30px, 0) scale(0.9);
          }
          80% {
            transform: translate(30px, 0) scale(0.9);
          }
          100% {
            transform: translate(30px, 0) scale(1);
          }
        }
        .tutorial-drag-animation {
          animation: tutorialDrag 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>,
    document.body
  );
};
