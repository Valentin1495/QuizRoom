import { useState, useEffect, useRef } from 'react';

export function useCountdown(totalMs: number, onEnd: () => void) {
  const [msLeft, setMsLeft] = useState(totalMs);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setMsLeft(prev => {
        if (prev <= 100) {
          clearInterval(intervalRef.current!);
          onEnd();
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [totalMs, onEnd]);

  return msLeft;
}
