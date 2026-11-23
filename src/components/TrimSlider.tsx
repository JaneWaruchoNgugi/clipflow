import { useRef, type PointerEvent } from 'react';
import { formatTime } from '../lib/time';

export const MIN_CLIP = 0.3;

/** Two-handle touch slider for picking the clip's start and end. */
export function TrimSlider(props: {
  duration: number;
  start: number;
  end: number;
  playhead: number;
  disabled?: boolean;
  onStart: (t: number) => void;
  onEnd: (t: number) => void;
}) {
  const { duration, start, end, playhead, disabled } = props;
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<'s' | 'e' | null>(null);
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);

  const timeAt = (x: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / r.width)) * duration;
  };
  const apply = (x: number) => {
    const t = timeAt(x);
    if (dragging.current === 's') props.onStart(t);
    else if (dragging.current === 'e') props.onEnd(t);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || !duration) return;
    const target = (e.target as HTMLElement).dataset.handle;
    const t = timeAt(e.clientX);
    dragging.current =
      target === 's' ? 's' : target === 'e' ? 'e' : Math.abs(t - start) < Math.abs(t - end) ? 's' : 'e';
    ref.current!.setPointerCapture(e.pointerId);
    apply(e.clientX);
  };

  return (
    <>
      <div
        className="trim"
        ref={ref}
        onPointerDown={down}
        onPointerMove={(e) => dragging.current && apply(e.clientX)}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <div className="track" />
        <div className="sel" style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }} />
        <div className="playhead" style={{ left: `${pct(playhead)}%` }} />
        <div className="handle" data-handle="s" style={{ left: `${pct(start)}%` }} aria-label="Start point" />
        <div className="handle end" data-handle="e" style={{ left: `${pct(end)}%` }} aria-label="End point" />
      </div>
      <div className="trimvals">
        <span>
          Start <b>{formatTime(start)}</b>
        </span>
        <span>
          Length <b>{(end - start).toFixed(1)}s</b>
        </span>
        <span>
          End <b>{formatTime(end)}</b>
        </span>
      </div>
    </>
  );
}
