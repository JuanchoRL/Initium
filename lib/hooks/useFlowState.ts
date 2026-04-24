import { useState, useCallback } from 'react';
import type { TransitionMap } from '../types';

export const canTransition = <T extends string>(current: T, next: T, map: TransitionMap<T>) => {
  if (current === next) return true;
  return map[current]?.includes(next) ?? false;
};

export const useStateMachine = <T extends string>(initial: T, transitions: TransitionMap<T>, label: string) => {
  const [state, setState] = useState<T>(initial);
  
  const transition = useCallback(
    (next: T, options?: { force?: boolean }) => {
      setState((current) => {
        if (options?.force || canTransition(current, next, transitions)) return next;
        console.warn(`[${label}] invalid transition`, { from: current, to: next });
        return current;
      });
    },
    [label, transitions]
  );
  
  return [state, transition] as const;
};
