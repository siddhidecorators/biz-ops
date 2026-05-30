'use client';

import type { CSSProperties } from 'react';

// Shared "win" visuals: a confetti burst and a self-drawing check. Used at the
// emotional peaks of the app — getting paid in full, and a customer accepting a
// quote. Both honour prefers-reduced-motion via globals.css.

const CONFETTI_COLORS = [
  'oklch(0.55 0.142 41)', // terracotta
  'oklch(0.58 0.125 150)', // green
  'oklch(0.76 0.145 76)', // amber
  'oklch(0.70 0.08 50)', // sand
];

export function Confetti({ count = 18 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1 z-10">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 70 + (i % 4) * 24;
        const cx = Math.cos(angle) * dist;
        const cy = Math.sin(angle) * dist - 24; // bias the burst upward
        const cr = (i % 2 ? 1 : -1) * (170 + (i % 5) * 36);
        return (
          <span
            key={i}
            className="confetti-piece"
            style={
              {
                '--cx': `${cx.toFixed(0)}px`,
                '--cy': `${cy.toFixed(0)}px`,
                '--cr': `${cr}deg`,
                animationDelay: `${(i % 6) * 25}ms`,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

export function SuccessCheck({ className = 'size-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path className="animate-check" d="M5 13l4 4L19 7" />
    </svg>
  );
}
