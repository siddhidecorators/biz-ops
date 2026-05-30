'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animate a number from 0 up to `target` once, on mount. Used for the money
 * figures so the dashboard feels alive when it lands. Honours
 * prefers-reduced-motion (and zero/negative targets) by jumping straight to the
 * final value — no animation, no layout surprise.
 *
 * Safe re: hydration because every caller renders this only on the client after
 * its data has loaded (the figure is never server-rendered with a live value).
 */
export function useCountUp(target: number, durationMs = 1000): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !Number.isFinite(target) || target <= 0) {
      setValue(target);
      return;
    }

    const start = performance.now();
    setValue(0);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutExpo — fast start, gentle settle
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}

/**
 * Tween a number smoothly from its previous value to the new `target` whenever
 * `target` changes. Unlike useCountUp, the first render returns `target`
 * unchanged (no entrance animation) — so it's safe for server-rendered figures
 * and ideal for values that update in place, like a balance dropping as a
 * payment is recorded.
 */
export function useTween(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const mountedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // First effect run = mount: adopt the target with no animation.
    if (!mountedRef.current) {
      mountedRef.current = true;
      fromRef.current = target;
      setValue(target);
      return;
    }

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !Number.isFinite(target)) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return value;
}
