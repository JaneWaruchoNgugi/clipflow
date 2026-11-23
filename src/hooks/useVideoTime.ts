import { useEffect, useState, type RefObject } from 'react';

/**
 * Current playback time of a video, updated every animation frame while playing
 * and on seeks while paused. Only components that call this re-render on time changes.
 */
export function useVideoTime(ref: RefObject<HTMLVideoElement | null>, src: string | null): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let raf = 0;
    const read = () => setT(v.currentTime);
    const frame = () => {
      read();
      if (!v.paused) raf = requestAnimationFrame(frame);
    };
    const onPlay = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };
    const events = ['seeked', 'seeking', 'pause', 'loadedmetadata', 'emptied'] as const;
    events.forEach((e) => v.addEventListener(e, read));
    v.addEventListener('play', onPlay);
    read();
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((e) => v.removeEventListener(e, read));
      v.removeEventListener('play', onPlay);
    };
  }, [ref, src]);
  return t;
}
