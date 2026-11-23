import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { drawFrame, outputSize } from '../lib/render';
import type { EditSettings } from '../lib/types';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  settings: EditSettings;
  ready: boolean;
  exporting: boolean;
  /** Bumped by the parent whenever the video's frame may have changed. */
  frameKey: number;
  overlay?: ReactNode;
  onTap?: () => void;
}

/**
 * Renders the edited frame into a canvas that is always fitted (contain) inside the stage,
 * for any aspect ratio. Redraws every frame while the video plays.
 */
export function PreviewStage({ videoRef, canvasRef, settings, ready, exporting, frameKey, overlay, onTap }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Keep the canvas resolution in step with format (lighter than export while editing).
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || exporting || !ready) return;
    const { w, h } = outputSize(v, settings);
    const k = Math.min(1, 720 / Math.max(w, h));
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    drawFrame(c, v, settings);
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, exporting, ready, frameKey]);

  // Fit the canvas to the stage box.
  const fit = () => {
    const s = stageRef.current;
    const c = canvasRef.current;
    if (!s || !c || !c.width) return;
    const r = s.getBoundingClientRect();
    const k = Math.min(r.width / c.width, r.height / c.height);
    c.style.width = `${Math.floor(c.width * k)}px`;
    c.style.height = `${Math.floor(c.height * k)}px`;
  };
  useLayoutEffect(() => {
    const s = stageRef.current;
    if (!s) return;
    const ro = new ResizeObserver(fit);
    ro.observe(s);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Export changes the canvas size; refit when it starts/ends.
  useEffect(() => {
    fit();
  });

  // Draw loop while playing (not during export: the exporter draws itself).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    const loop = () => {
      const c = canvasRef.current;
      if (c) drawFrame(c, v, settingsRef.current);
      if (!v.paused) raf = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      if (exporting) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    const onStill = () => {
      if (exporting) return;
      const c = canvasRef.current;
      if (c) drawFrame(c, v, settingsRef.current);
    };
    v.addEventListener('play', onPlay);
    v.addEventListener('seeked', onStill);
    v.addEventListener('loadeddata', onStill);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('seeked', onStill);
      v.removeEventListener('loadeddata', onStill);
    };
  }, [videoRef, canvasRef, exporting]);

  return (
    <div className="stage" ref={stageRef} onClick={onTap}>
      <canvas ref={canvasRef} className="stage__canvas" aria-label="Edited video preview" role="img" />
      {overlay}
    </div>
  );
}
