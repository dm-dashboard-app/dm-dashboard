import { useEffect, useRef } from 'react';

export default function usePolling(fn, interval = 2000, active = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return;

    function tick() {
      fnRef.current();
    }

    // Fire immediately on mount
    tick();

    // Regular interval
    const timer = setInterval(tick, interval);

    // Fire immediately when phone unlocks or tab becomes visible
    function handleVisibility() {
      if (document.visibilityState === 'visible') tick();
    }

    // Fire when window regains focus
    function handleFocus() {
      tick();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [active, interval]);
}