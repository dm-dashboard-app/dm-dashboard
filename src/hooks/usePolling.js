import { useEffect, useRef } from 'react';

// Polls a function every `interval` ms while the page is visible.
// Immediately calls on mount and when page becomes visible again.
export default function usePolling(fn, interval = 2000, active = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!active) return;

    let timer;

    function tick() {
      fnRef.current();
    }

    function schedule() {
      timer = setInterval(tick, interval);
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        tick();         // immediate refresh on unlock
        schedule();
      } else {
        clearInterval(timer);
      }
    }

    tick();
    schedule();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active, interval]);
}