'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export function SplashScreen() {
  const [state, setState] = useState<'visible' | 'exiting' | 'hidden'>('visible');

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const exitTimer = window.setTimeout(
      () => setState('exiting'),
      reducedMotion ? 250 : 1300,
    );
    const hideTimer = window.setTimeout(
      () => setState('hidden'),
      reducedMotion ? 300 : 1650,
    );

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (state === 'hidden') return null;

  return (
    <div
      className={`splash-screen${state === 'exiting' ? ' splash-screen-exiting' : ''}`}
      role="status"
      aria-label="Loading SSF Mukkam Finance"
    >
      <Image
        className="splash-logo"
        src="/logo.png"
        width={750}
        height={1600}
        alt=""
        preload
      />
      <span className="visually-hidden">Loading SSF Mukkam Finance</span>
    </div>
  );
}
