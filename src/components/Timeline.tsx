import { memo, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { useVideoTime } from '../hooks/useVideoTime';
import { formatTime } from '../lib/time';

export const MIN_CLIP = 0.3;

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string | null;
  duration: number;
  start: number;
  end: number;
  thumbs: string[];
  disabled?: boolean;
  onStart: (t: number) => void;
  onEnd: (t: number) => void;
  onSeek: (t: number) => void;
}

/**
 * Touch-friendly trim timeline: a filmstrip with a trim frame.
 * Drag the frame's edges to trim; tap or drag the strip to scrub the playhead.
 * Each edge is also a keyboard slider (arrows ±0.1s, Shift ±1s, Home/End).
 */
export const Timeline = memo(function Timeline(p: Props) {
  const { duration, start, end, disabled } = p;
  const now = useVideoTime(p.videoRef, p.src);
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef<'s' | 'e' | 'scrub' | null>(null);
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);

  const timeAt = (x: number) => {
    const r = stripRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / r.width)) * duration;
  };
  const apply = (x: number) => {
    const t = timeAt(x);
    if (drag.current === 's') p.onStart(t);
    else if (drag.current === 'e') p.onEnd(t);
    else if (drag.current === 'scrub') p.onSeek(Math.max(start, Math.min(end, t)));
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || !duration || e.button > 0) return;
    const h = (e.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset.handle;
    drag.current = h === 's' ? 's' : h === 'e' ? 'e' : 'scrub';
    e.currentTarget.setPointerCapture(e.pointerId);
    apply(e.clientX);
  };
  const up = () => (drag.current = null);

  const key = (which: 's' | 'e') => (e: KeyboardEvent) => {
    const cur = which === 's' ? start : end;
    const step = e.shiftKey ? 1 : 0.1;
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - step;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + step;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = duration;
    if (next === null) return;
    e.preventDefault();
    (which === 's' ? p.onStart : p.onEnd)(next);
  };

  const handle = (which: 's' | 'e') => {
    const t = which === 's' ? start : end;
    return (
      <div
        className={`tl__handle tl__handle--${which === 's' ? 'start' : 'end'}`}
        data-handle={which}
        style={{ left: `${pct(t)}%` }}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={which === 's' ? 'Clip start' : 'Clip end'}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration * 10) / 10}
        aria-valuenow={Math.round(t * 10) / 10}
        aria-valuetext={formatTime(t)}
        aria-disabled={disabled || undefined}
        onKeyDown={key(which)}
      >
        <span className="tl__grip" />
      </div>
    );
  };

  return (
    <div className={`tl${disabled ? ' is-disabled' : ''}`}>
      <div className="tl__meta">
        <span className="tl__now">
          <b>{formatTime(now)}</b> / {formatTime(duration)}
        </span>
        <span className="chip">
          Clip {(end - start).toFixed(1)}s
        </span>
      </div>
      <div
        className="tl__track"
        ref={stripRef}
        onPointerDown={down}
        onPointerMove={(e) => drag.current && apply(e.clientX)}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="tl__strip" aria-hidden="true">
          {p.thumbs.map((u, i) => (
            <img key={u} src={u} alt="" draggable={false} style={{ animationDelay: `${i * 20}ms` }} />
          ))}
        </div>
        <div className="tl__dim" style={{ left: 0, width: `${pct(start)}%` }} />
        <div className="tl__dim" style={{ left: `${pct(end)}%`, right: 0 }} />
        <div className="tl__frame" style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }} />
        <div className="tl__playhead" style={{ left: `${pct(now)}%` }} />
        {handle('s')}
        {handle('e')}
      </div>
      <div className="tl__ends">
        <span>
          <i className="dot dot--start" />
          Start {formatTime(start)}
        </span>
        <span>
          End {formatTime(end)}
          <i className="dot dot--end" />
        </span>
      </div>
    </div>
  );
});
