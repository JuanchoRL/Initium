import React, { useEffect, useState } from 'react';

export const AnimatedNumber = ({
  value,
  duration = 1000,
  className = '',
}: {
  value: number;
  duration?: number;
  className?: string;
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrame: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(easeProgress * value));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      }
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [value, duration]);

  return <span className={className}>{displayValue}</span>;
};
