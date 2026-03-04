import { useEffect, useRef } from 'react';

export default function usePolling(fn, interval = 2000, active = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return;

    let wakeTimer = null;

    function tick() {
      fnRef.current();
    }

    // Fire immediately on mount
    tick();

    const timer = setInterval(tick, interval);

    // On wake/focus, wait 800ms for network to be ready before polling
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        clearTimeout(wakeTimer);
        wakeTimer = setTimeout(tick, 800);
      }
    }

    function handleFocus() {
      clearTimeout(wakeTimer);
      wakeTimer = setTimeout(tick, 800);
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);

    return () => {
      clearInterval(timer);
      clearTimeout(wakeTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [active, interval]);
}