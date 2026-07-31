'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Count-up animation for KPI numbers. Animates 0 → value on mount and from the
 * previous value on change, using Framer Motion's useSpring for smooth animation.
 * Respects prefers-reduced-motion (snaps to final value).
 */
export function AnimatedNumber({
  value,
  duration = 750,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // cubic-bezier(0.32, 0.72, 0, 1) approximation
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    requestAnimationFrame(tick);
    return () => {
      fromRef.current = value;
    };
  }, [value, duration, reducedMotion]);

  return <span className={className}>{format(display)}</span>;
}