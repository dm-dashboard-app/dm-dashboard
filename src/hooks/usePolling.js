import { useEffect, useRef, useCallback } from 'react';

export default function usePolling(fn, interval = 2000, active = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const tick = useCallback(() => {
    fnRef.current();
  }, []);

  useEffect(() => {
    if (!active) return;

    // Fire immediately
    tick();

    // Then every interval
    const timer = setInterval(tick, interval);

    // Fire immediately when tab/phone becomes visible again
    function handleVisibility() {
      if (document.visibilityState === 'visible') tick();
    }

    // Fire when window regains focus (covers phone unlock edge case)
    function handleFocus() {
      tick();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [active, interval, tick]);
}