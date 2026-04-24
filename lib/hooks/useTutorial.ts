import { useState, useCallback, useEffect, useRef } from 'react';

export type TutorialStep = {
  id: string;
  targetId: string; // The CSS id of the DOM element to focus
  title: string;
  description?: string;
  actionRequired: 'click' | 'drag' | 'custom';
  animationType?: 'click' | 'drag' | 'none';
};

export function useTutorial(steps: TutorialStep[], isEnabled: boolean) {
  const [isActive, setIsActive] = useState(isEnabled);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = steps[currentStepIndex] || null;

  const calculateTargetRect = useCallback(() => {
    if (!isActive || !currentStep) return;

    // Allow React time to render dynamically generated IDs
    requestAnimationFrame(() => {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    });
  }, [isActive, currentStep]);

  useEffect(() => {
    if (!isActive) return;
    calculateTargetRect();
    window.addEventListener('resize', calculateTargetRect);
    window.addEventListener('scroll', calculateTargetRect);

    const intervalId = setInterval(() => {
      calculateTargetRect();
    }, 500);

    return () => {
      window.removeEventListener('resize', calculateTargetRect);
      window.removeEventListener('scroll', calculateTargetRect);
      clearInterval(intervalId);
    };
  }, [isActive, calculateTargetRect]);

  const advanceStep = useCallback(() => {
    if (!isActive) return;
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsActive(false);
    }
  }, [isActive, currentStepIndex, steps.length]);

  const finishTutorial = useCallback(() => {
    setIsActive(false);
  }, []);

  return {
    isActive,
    currentStep,
    targetRect,
    advanceStep,
    finishTutorial,
    recalculatePosition: calculateTargetRect,
  };
}
